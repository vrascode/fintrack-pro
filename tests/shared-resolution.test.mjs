import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

test('shared public imports select source for app platforms and compiled JavaScript for Node', () => {
  for (const condition of ['browser', 'react-native', undefined]) {
    const expected = pathToFileURL(
      resolve(
        import.meta.dirname,
        '../packages/shared',
        condition ? 'src/index.ts' : 'dist/index.js',
      ),
    ).href;
    const result = spawnSync(
      process.execPath,
      [
        ...(condition ? [`--conditions=${condition}`] : []),
        '--input-type=module',
        '-e',
        `import { addMoney } from '@fintrack/shared';
         console.log(JSON.stringify({ entry: import.meta.resolve('@fintrack/shared'), total: addMoney(100n, 25n).toString() }));`,
      ],
      { cwd: resolve(import.meta.dirname, '..'), encoding: 'utf8', windowsHide: true },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { entry: expected, total: '125' });
  }
});
