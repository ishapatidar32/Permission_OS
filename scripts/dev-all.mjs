import { spawn } from 'node:child_process';
import process from 'node:process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const services = [
  { name: 'gateway', args: ['run', 'dev:gateway'] },
  { name: 'upstream', args: ['run', 'dev:upstream'] },
  { name: 'web', args: ['run', 'dev:web'] },
];
const children = services.map(({ name, args }) => {
  const child = spawn(npm, args, { stdio: 'inherit', env: { ...process.env, FORCE_COLOR: '1' }, shell: process.platform === 'win32' });
  child.on('exit', (code) => {
    if (code && code !== 0) console.error(`[${name}] exited with code ${code}`);
  });
  return child;
});
const shutdown = () => { for (const child of children) if (!child.killed) child.kill('SIGTERM'); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
console.log('PermissionOS services starting: gateway :4000, demo upstream :4001, web :5173');
