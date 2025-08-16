// Node.js ESM script: fixMissingDeps.mjs
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const projectRoot = process.cwd();
const tsFiles = [];
const importedModules = new Set();
const installedModules = [];
const installedTypes = [];
const alreadyPresent = [];

// Recursively find all .ts files
function findTSFiles(dir) {
  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      findTSFiles(fullPath);
    } else if (file.endsWith('.ts')) {
      tsFiles.push(fullPath);
    }
  }
}
findTSFiles(projectRoot);

// Scan for import statements
const importRegex = /import\s+(?:.+?\s+from\s+)?["']([^"']+)["']/g;
tsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const mod = match[1];
    // Ignore relative imports
    if (
      !mod.startsWith('.') &&
      !mod.startsWith('/') &&
      !mod.startsWith('node:')
    ) {
      importedModules.add(mod.split('/')[0] === '@' ? mod.split('/').slice(0,2).join('/') : mod.split('/')[0]);
    }
  }
});

// Read package.json
const pkgPath = path.join(projectRoot, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const allDeps = Object.assign({}, pkg.dependencies, pkg.devDependencies);

// Check and install missing modules
for (const mod of importedModules) {
  if (mod.startsWith('node:')) {
    alreadyPresent.push(mod + ' (core module)');
    continue;
  }
  if (allDeps[mod]) {
    alreadyPresent.push(mod);
    continue;
  }
  try {
    execSync(`npm install ${mod}`, { stdio: 'inherit' });
    installedModules.push(mod);
  } catch (e) {
    console.error(`Failed to install ${mod}`);
  }
  // Try to install type declarations
  if (!mod.startsWith('@types/')) {
    try {
      execSync(`npm install --save-dev @types/${mod.replace('@','').replace('/','__')}`, { stdio: 'inherit' });
      installedTypes.push(`@types/${mod.replace('@','').replace('/','__')}`);
    } catch (e) {
      // Some modules may not have types
    }
  }
}

// Update tsconfig.json
const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
let tsconfig;
if (fs.existsSync(tsconfigPath)) {
  tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
} else {
  tsconfig = {};
}
tsconfig.compilerOptions = tsconfig.compilerOptions || {};
tsconfig.compilerOptions.moduleResolution = 'node';
tsconfig.compilerOptions.esModuleInterop = true;
tsconfig.compilerOptions.resolveJsonModule = true;
tsconfig.compilerOptions.strict = true;
tsconfig.compilerOptions.skipLibCheck = true;
tsconfig.compilerOptions.downlevelIteration = true;
fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));

// Log report
console.log('--- Dependency Report ---');
console.log('Already present:', alreadyPresent);
console.log('Installed modules:', installedModules);
console.log('Installed type declarations:', installedTypes);
console.log('-------------------------');
console.log('✅ Dependencies and TypeScript declarations fixed.');
