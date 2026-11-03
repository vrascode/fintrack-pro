import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertSafePath,
  secretFindings,
  digest,
  applyVerifiedPatch,
  root,
} from '../scripts/publish-pending-check.mjs';

test('publication rejects secrets, runtime artifacts and traversal paths', () => {
  for (const path of [
    '../outside',
    'apps/../outside',
    '.env',
    'apps/mobile/.env.local',
    '.git/config',
    '.local/report.json',
    'node_modules/pkg',
    'apps/api/dist/app.js',
    'C:/outside',
    'README.md\n.env',
  ])
    assert.throws(() => assertSafePath(path));
  for (const path of [
    '.env.example',
    'README.md',
    'apps/mobile/app/(tabs)/activity.tsx',
    'scripts/publish-patches/02-database-filter-app.patch',
  ])
    assert.equal(assertSafePath(path), path);
});
test('publication reports secret patterns without including their values', () => {
  const token = 'ghp_' + 'x'.repeat(36);
  const findings = secretFindings('source.ts', token);
  assert.equal(findings.length, 1);
  assert.equal(JSON.stringify(findings).includes(token), false);
  assert.equal(
    secretFindings('.env.example', 'POSTGRES_PASSWORD=\nPOSTGRES_TEST_PASSWORD=\n').length,
    0,
  );
  assert.equal(secretFindings('.env.example', 'POSTGRES_PASSWORD=unsafe-value').length, 1);
  const databaseUri = [
    'postgresql://user:',
    'synthetic-strong-credential',
    '@db.example.com/app',
  ].join('');
  assert.equal(secretFindings('tests/private.test.mjs', databaseUri).length, 1);
});
test('complete-file staging patches require exact before and after digests', () => {
  const before = 'old\n';
  const after = 'new\n';
  const patch = 'diff --git a/file b/file\n--- a/file\n+++ b/file\n@@ -1,1 +1,1 @@\n-old\n+new\n';
  const specification = { path: 'file', before: digest(before), after: digest(after) };
  assert.equal(applyVerifiedPatch(before, patch, specification), after);
  assert.throws(() => applyVerifiedPatch(null, patch, specification), /baseline is unavailable/);
  assert.throws(() => applyVerifiedPatch('another\n', patch, specification), /baseline differs/);
  assert.throws(
    () => applyVerifiedPatch(before, patch.replace('+new', '+unknown'), specification),
    /output differs/,
  );
});
test(
  'PowerShell publisher parses without errors on Windows PowerShell',
  { skip: process.platform !== 'win32' },
  () => {
    const path = resolve(root, 'scripts/publish-pending-commits.ps1').replaceAll("'", "''");
    const command = `$tokens=$null; $errors=$null; [System.Management.Automation.Language.Parser]::ParseFile('${path}',[ref]$tokens,[ref]$errors) | Out-Null; if($errors.Count){ $errors | ForEach-Object { $_.Message }; exit 1 }`;
    assert.doesNotThrow(() =>
      execFileSync('powershell.exe', ['-NoProfile', '-Command', command], {
        encoding: 'utf8',
        windowsHide: true,
      }),
    );
  },
);
test('publisher never stashes work or bypasses Git, ACLs or execution policy', () => {
  const source = readFileSync(resolve(root, 'scripts/publish-pending-commits.ps1'), 'utf8');
  for (const expression of [
    /git['"]?\s+@\(['"]reset/,
    /git['"]?\s+@\(['"]stash/,
    /--force/,
    /Set-ExecutionPolicy/,
    /icacls/,
    /Invoke-Expression/,
  ])
    assert.doesNotMatch(source, expression);
  assert.match(source, /'push', 'origin', 'main'/);
  assert.match(source, /'staged', \$unit.id/);
  assert.match(source, /'ls-remote', 'origin', 'refs\/heads\/main'/);
});
