# Email & Mobile OTP Verification System

**LexisMatch AI** — Smart Adv Assistance for Legal Case (Group ID: 30)

---

## 1. Overview
The verification system ensures that both **Client** and **Advocate** users confirm their identity and contact details before accessing protected platform dashboards (`/client`, `/advocate`).

Users can choose between two verification methods during registration:
1. **Option A: Email Verification**: 6-digit OTP delivered via SMTP (Gmail / Nodemailer).
2. **Option B: Mobile OTP Verification**: 6-digit OTP delivered via SMS gateway (MSG91 / 2Factor).

> [!IMPORTANT]
> **Distinction Between Contact Verification and Bar Verification:**
> Contact verification (Email/Mobile OTP) proves control over the communication channel. An Advocate's profile still requires official Bar Council review by the Admin in the Ops Console before receiving `VERIFIED` status for matching.

---

## 2. Security Architecture

| Security Rule | Implementation |
| :--- | :--- |
| **Code Generation** | Cryptographically secure random 6-digit string (`crypto.randomInt(100000, 1000000)`). |
| **Storage Security** | Hashed with **bcrypt** (salt rounds = 10). Plaintext OTP is **never** stored in the database. |
| **Code Expiration** | Strictly valid for **5 minutes** (300 seconds). Expired codes are rejected. |
| **Resend Cooldown** | Strict **60-second cooldown** between resend requests per identifier. |
| **Max Attempts** | Maximum **5 incorrect attempts** allowed per OTP. On the 5th failed attempt, the OTP is invalidated. |
| **Replay Prevention** | Single-use: once verified (`status = 'VERIFIED'`), the code cannot be reused. |
| **Previous Invalidation** | Requesting a new code automatically invalidates all previously pending codes for that identifier. |
| **Brute-Force Guard** | Rate-limited to at most 8 requests per 15-minute window per identifier. |
| **Access Control** | Unverified users receive `403 Forbidden` (`isUnverified: true`) on login attempts. |

---

## 3. Database Schema

Additive `OtpVerification` model in `backend/prisma/schema.prisma`:

```prisma
model User {
  id                 String   @id @default(uuid())
  email              String   @unique
  phone              String?
  passwordHash       String
  role               String   @default("CLIENT")
  preferredLanguage  String   @default("en")
  isVerified         Boolean  @default(false)
  emailVerified      Boolean  @default(false)
  phoneVerified      Boolean  @default(false)
  verificationMethod String?  // "EMAIL" | "PHONE"
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  client             Client?
  advocate           Advocate?
  otpVerifications   OtpVerification[]
}

model OtpVerification {
  id                String    @id @default(uuid())
  userId            String?
  identifier        String    // Email or phone number
  type              String    // "EMAIL" | "PHONE"
  otpHash           String    // Hashed with bcrypt
  attempts          Int       @default(0)
  maxAttempts       Int       @default(5)
  expiresAt         DateTime
  resendAvailableAt DateTime
  verifiedAt        DateTime?
  status            String    @default("PENDING") // PENDING, VERIFIED, EXPIRED, FAILED
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  user              User?     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([identifier, type, status])
}
```

### Migration Commands
```bash
# Push schema changes to the existing SQLite database without resetting data:
npx prisma db push

# Re-generate the Prisma Client:
npx prisma generate
```

---

## 4. Email Setup (Gmail SMTP & App Password)

1. **Enable 2-Step Verification**:
   - Go to your [Google Account Security Settings](https://myaccount.google.com/security).
   - Ensure **2-Step Verification** is turned ON.
2. **Generate an App Password**:
   - In the search bar inside your Google Account, search for **App passwords**.
   - Select App name: `LexisMatch AI` or `Other (Custom name)`.
   - Google will display a **16-character password** (e.g., `abcd efgh ijkl mnop`).
3. **Configure Backend Environment Variables** (`backend/.env`):
   ```env
   MAIL_HOST="smtp.gmail.com"
   MAIL_PORT="587"
   MAIL_USER="your-email@gmail.com"
   MAIL_PASSWORD="abcdefghijklmnop"
   MAIL_FROM="\"LexisMatch AI\" <your-email@gmail.com>"
   ```

---

## 5. Mobile SMS Setup (MSG91 / 2Factor)

### Option A: MSG91 (Recommended for India)
1. Sign up on [MSG91](https://msg91.com).
2. Create an OTP template and obtain DLT approval as per Indian telecom regulations.
3. Configure `backend/.env`:
   ```env
   SMS_PROVIDER="msg91"
   SMS_API_KEY="your_msg91_authkey"
   SMS_TEMPLATE_ID="your_dlt_template_id"
   SMS_SENDER_ID="LXMTCH"
   ```

### Option B: 2Factor (Direct OTP SMS API)
1. Register on [2Factor.in](https://2factor.in).
2. Copy your API Key.
3. Configure `backend/.env`:
   ```env
   SMS_PROVIDER="2factor"
   SMS_API_KEY="your_2factor_api_key"
   SMS_TEMPLATE_ID="your_template_name"
   ```

---

## 6. Local Development & Testing Mode

When running locally without real SMTP or SMS credentials:
- The system **safely disables** live dispatch instead of crashing or faking successful transmission.
- Generated OTPs are automatically logged to the backend terminal log:
  ```
  [EmailService] [DEV LOG] Email OTP generated for user@example.com: [ 482910 ]
  [SmsService] [DEV LOG] Mobile OTP generated for +919876543210: [ 719302 ]
  ```
- Developers and QA testers can test the complete end-to-end registration, verification, countdown timers, resend, and access control flows with zero external dependencies.

---

## 7. API Reference

### 1. `POST /api/auth/register`
Initiates account registration and automatically sends the first OTP via the chosen method.
```json
{
  "email": "user@example.com",
  "password": "Password123!",
  "role": "CLIENT", // or "ADVOCATE"
  "name": "Jane Doe",
  "phone": "+919876543210",
  "verificationMethod": "EMAIL" // or "PHONE"
}
```

### 2. `POST /api/auth/verification/verify`
Validates the submitted 6-digit code and marks the account as verified.
```json
{
  "identifier": "user@example.com",
  "type": "EMAIL",
  "otp": "482910"
}
```

### 3. `POST /api/auth/verification/resend`
Enforces the 60-second cooldown, invalidates old codes, and generates a new OTP.
```json
{
  "identifier": "user@example.com",
  "type": "EMAIL"
}
```

### 4. `GET /api/auth/verification/status?identifier=user@example.com&type=EMAIL`
Returns verification state, cooldown seconds remaining, and active pending status.
