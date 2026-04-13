import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const shouldSkip = process.env.SKIP_STEALTH_POSTINSTALL === '1';
const stealthPkg = 'stealth-proxy/package.json';

if (shouldSkip) {
  console.log('[postinstall] SKIP_STEALTH_POSTINSTALL=1, skipping stealth-proxy setup');
  process.exit(0);
}

if (!existsSync(stealthPkg)) {
  console.log('[postinstall] stealth-proxy/package.json not found, skipping stealth-proxy setup');
  process.exit(0);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: 'stealth-proxy',
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run('npm', ['install']);
run('npx', ['playwright', 'install', 'chromium']);
