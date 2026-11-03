import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));

export function expoEnvironment(environment = process.env, rootEnvPath = resolve(root, '.env')) {
  const value = existsSync(rootEnvPath)
    ? parseEnv(readFileSync(rootEnvPath, 'utf8')).EXPO_PUBLIC_API_URL
    : undefined;
  // Only public application configuration is forwarded from the root file.
  return {
    ...environment,
    ...(value && !environment.EXPO_PUBLIC_API_URL ? { EXPO_PUBLIC_API_URL: value } : {}),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const require = createRequire(import.meta.url);
  const child = spawn(
    process.execPath,
    [require.resolve('expo/bin/cli'), ...process.argv.slice(2)],
    {
      cwd: resolve(root, 'apps/mobile'),
      env: expoEnvironment(),
      stdio: 'inherit',
      windowsHide: true,
    },
  );
  child.once('error', () => {
    console.error('Could not start Expo. Check the installed workspace dependencies.');
    process.exitCode = 1;
  });
  child.once('exit', (code) => {
    process.exitCode = code ?? 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill());
}
