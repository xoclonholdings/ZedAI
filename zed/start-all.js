const { spawn } = require('child_process');
const path = require('path');

function runScript(cmd, cwd) {
  const proc = spawn(cmd, { shell: true, cwd, stdio: 'inherit' });
  return proc;
}

console.log('Starting Zed backend...');
const backend = runScript('npm run dev', path.join(__dirname, 'backend'));

setTimeout(() => {
  console.log('Starting Zed frontend...');
  runScript('npm run dev', path.join(__dirname, 'frontend'));
}, 3000);
