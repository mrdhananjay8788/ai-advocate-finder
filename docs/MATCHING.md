# Matching Engine Documentation

The matching engine recommends verified Advocates to a Client based on the details extracted from their Case.

## The Matching Algorithm

The matching process is rule-based and scores eligible advocates up to a maximum of 100 points. The system evaluates the `Case` object against all `VERIFIED` and `AVAILABLE` Advocates in the database.

### Filtering Rules
Before scoring, the engine filters out any advocate who does not meet the baseline prerequisites:
1. `verifiedStatus === 'VERIFIED'`
2. `availabilityStatus === true`

### Scoring Breakdown (100 Points Total)

1. **Specialization (35 Points - Highest Priority)**
   - **Logic**: Normalizes and compares `Case.caseType` (e.g., `CRIMINAL`, `FAMILY`) against the Advocate's `practiceAreas` array.
   - **Score**: 35 if an exact normalized match is found, otherwise 0.

2. **Jurisdiction (20 Points)**
   - **Logic**: Compares `Case.jurisdiction` against the Advocate's `city` and `state`.
   - **Score**: 
     - 20 points if the `Case.jurisdiction` includes the Advocate's `city`.
     - 10 points if it includes the Advocate's `state` but not the `city`.
     - 0 points otherwise.

3. **Rating (15 Points)**
   - **Logic**: Evaluates the Advocate's `ratingAvg` if `reviewCount > 0`.
   - **Score**: `ratingAvg * 3` (e.g., a 5.0 rating yields 15 points).

4. **Experience (10 Points)**
   - **Logic**: Evaluates `Advocate.yearsExperience`.
   - **Score**: 
     - 10+ years = 10 points
     - 7-9 years = 8 points
     - 4-6 years = 6 points
     - 1-3 years = 4 points
     - 0 years = 0 points

5. **Availability (10 Points)**
   - **Logic**: Always grants 10 points for this step since filtering already removed unavailable advocates. 

6. **Budget (5 Points)**
   - **Logic**: Normalizes and compares `Case.budgetRange` against `Advocate.feeRange`.
   - **Score**: 5 points for an exact match.

7. **Language (5 Points)**
   - **Logic**: Normalizes and compares `Case.language` against the `Advocate.languages` array.
   - **Score**: 5 points if a match is found.

## Example Output
When matching is requested, the engine calculates the scores, sorts the advocates descending, and limits the output to the top 10 matches. A `Match` record is saved in the database associating the `Case` and `Advocate` with the `matchScore` and `scoreBreakdown`.

## Disclaimer
Matching is a recommendation mechanism based solely on the categorical overlap of database fields. It does not constitute an endorsement of the advocate's quality or a guarantee of case outcome.
