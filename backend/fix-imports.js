const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const seedFile = path.join(__dirname, 'prisma', 'seed.ts');

const enumRegex = /import\s+\{([^}]+)\}\s+from\s+['"]@prisma\/client['"]/g;
const ENUMS = ['Role', 'VerificationStatus', 'CaseType', 'UrgencyLevel', 'CaseStage', 'CaseStatus', 'ChatSessionStatus', 'ChatMessageRole', 'MatchStatus', 'ConnectionRequestStatus'];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  content = content.replace(enumRegex, (match, importsStr) => {
    const imports = importsStr.split(',').map(s => s.trim()).filter(s => s);
    const prismaImports = [];
    const localImports = [];

    imports.forEach(imp => {
      if (ENUMS.includes(imp)) {
        localImports.push(imp);
      } else {
        prismaImports.push(imp);
      }
    });

    if (localImports.length === 0) return match;

    modified = true;
    
    // Determine relative path to prisma-enums.ts
    let relPath = '';
    if (filePath === seedFile) {
      relPath = '../src/prisma-enums';
    } else {
      const depth = filePath.substring(srcDir.length + 1).split(path.sep).length - 1;
      if (depth === 0) relPath = './prisma-enums';
      else relPath = '../'.repeat(depth) + 'prisma-enums';
    }

    let replacement = '';
    if (prismaImports.length > 0) {
      replacement += `import { ${prismaImports.join(', ')} } from '@prisma/client';\n`;
    }
    replacement += `import { ${localImports.join(', ')} } from '${relPath}';`;
    return replacement;
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function walk(dir) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  });
}

walk(srcDir);
if (fs.existsSync(seedFile)) processFile(seedFile);
