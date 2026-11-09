const { spawn } = require('node:child_process');
const { resolve } = require('node:path');

const frontend = resolve(__dirname, '../frontend');
const backend = resolve(__dirname, '../backend');
const children = [
  spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'watch', 'src/index.ts'], {
    cwd: backend,
    stdio: 'inherit',
  }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--strictPort'], {
    cwd: frontend,
    stdio: 'inherit',
  }),
];

let stopping = false;
function stop(exitCode) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const child of children) child.kill();
}

for (const child of children) {
  child.on('exit', (code) => stop(code ?? 1));
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
}
process.on('SIGINT', () => stop(130));
process.on('SIGTERM', () => stop(143));
