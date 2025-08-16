const fs = require('fs');
const path = require('path');

const pkgPath = path.resolve(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const flags = ['--host 0.0.0.0', '--force', '--debug'];
const viteScriptRegex = /^(vite|vite\s+preview)(.*)$/;

const originalScripts = {};
const updatedScripts = {};
let changed = false;

for (const [key, value] of Object.entries(pkg.scripts || {})) {
    const scriptStr = String(value);
    const match = viteScriptRegex.exec(scriptStr);
    if (match) {
        originalScripts[key] = scriptStr;
        let script = scriptStr;
        for (const flag of flags) {
            const flagRegex = new RegExp(flag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            if (!flagRegex.test(script)) {
                script += ` ${flag}`;
            }
        }
        // Remove duplicate flags if any
        for (const flag of flags) {
            const flagRegex = new RegExp(`(${flag})+`, 'g');
            script = script.replace(flagRegex, flag);
        }
        updatedScripts[key] = script;
        pkg.scripts[key] = script;
        changed = true;
    }
}

if (changed) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
}

console.log('--- Vite Script Audit Report ---');
console.log('Original Scripts:');
console.log(originalScripts);
console.log('Updated Scripts:');
console.log(updatedScripts);
if (changed) {
    console.log('package.json was updated and saved.');
} else {
    console.log('No Vite scripts needed updating.');
}
console.log('✅ Vite dev/preview scripts updated for container environments.');
