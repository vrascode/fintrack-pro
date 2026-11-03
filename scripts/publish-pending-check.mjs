// Read-only publication checks. This never writes Git objects, refs or the index.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, extname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

export const root = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]$/, '');
export const planPath = 'scripts/publish-pending-plan.json';
const normalize = (value) => value.replace(/^\uFEFF/, '').replaceAll('\r\n', '\n');
export const digest = (value) => createHash('sha256').update(value).digest('hex');
export function assertSafePath(path) {
  if (
    typeof path !== 'string' ||
    !path ||
    isAbsolute(path) ||
    /[\\:]/.test(path) ||
    [...path].some(
      (character) => character.codePointAt(0) < 32 || character.codePointAt(0) === 127,
    ) ||
    path
      .split('/')
      .some(
        (p) =>
          !p ||
          p === '.' ||
          p === '..' ||
          /^(\.git|\.local|\.cache|node_modules|dist|generated)$/i.test(p),
      ) ||
    (/(^|\/)\.env(?:\.|$)/i.test(path) && path !== '.env.example')
  )
    throw new Error(`Unsafe publication path: ${path}`);
  return path;
}
export function fingerprint(path) {
  assertSafePath(path);
  if (!existsSync(resolve(root, path))) return null;
  const value = readFileSync(resolve(root, path));
  return digest(extname(path) === '.png' ? value : normalize(value.toString('utf8')));
}
export function secretFindings(_path, text) {
  const findings = [];
  if (
    /(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|AKIA[0-9A-Z]{16})/.test(
      text,
    )
  )
    findings.push('credential/private-key pattern');
  if (
    /^[ \t]*(?:POSTGRES(?:_TEST)?_PASSWORD|GH_TOKEN|GITHUB_TOKEN)[ \t]*=[ \t]*[^\s#]+/m.test(text)
  )
    findings.push('nonempty secret environment assignment');
  // Synthetic loopback/test fixtures and documented placeholders are intentional.
  for (const match of text.matchAll(
    /postgres(?:ql)?:\/\/([^\s/:'"`]+):([^\s@'"`]+)@([^\s/'"`]+)/g,
  )) {
    const safe =
      match[2].includes('${') ||
      /[<>]/.test(match[2]) ||
      /^(generate|test|secret|app|admin|integration|user|password|pass|example|demo)$/i.test(
        match[2],
      );
    if (!safe) findings.push('literal database credential requires review');
  }
  return [...new Set(findings)];
}
const git = (args, options = {}) =>
  execFileSync('git', args, { cwd: root, maxBuffer: 64 * 1024 * 1024, ...options });
export function changedPaths() {
  return [
    ...new Set(
      git(['ls-files', '--modified', '--deleted', '--others', '--exclude-standard', '-z'])
        .toString('utf8')
        .split('\0')
        .filter(Boolean),
    ),
  ].sort();
}
export function loadPlan() {
  const raw = readFileSync(resolve(root, planPath), 'utf8');
  const plan = JSON.parse(normalize(raw));
  if (
    plan.schema !== 1 ||
    plan.branch !== 'main' ||
    plan.remote !== 'https://github.com/vrascode/fintrack-pro.git' ||
    !/^[a-f0-9]{40}$/.test(plan.base)
  )
    throw new Error('Unexpected publication plan identity.');
  const paths = new Set();
  const ids = new Set();
  for (const unit of plan.units) {
    if (
      !/^[0-9]{2}-[a-z-]+$/.test(unit.id) ||
      ids.has(unit.id) ||
      !/^(fix|feat|test|docs|style|chore|refactor|ci)(\([a-z-]+\))?: .+/.test(unit.message)
    )
      throw new Error('Invalid/duplicate publication unit.');
    ids.add(unit.id);
    for (const path of unit.files) paths.add(assertSafePath(path));
    for (const patch of unit.patches ?? []) {
      paths.add(assertSafePath(patch.path));
      assertSafePath(patch.file);
    }
    for (const dependency of unit.dependsOn ?? [])
      if (!ids.has(dependency)) throw new Error(`Invalid dependency order: ${unit.id}`);
  }
  for (const path of paths) {
    if (path === planPath) continue; // The manifest cannot contain its own content digest.
    if (!Object.hasOwn(plan.fingerprints, path) || fingerprint(path) !== plan.fingerprints[path])
      throw new Error(`Working file differs from the reviewed plan: ${path}`);
    if (existsSync(resolve(root, path)) && extname(path) !== '.png') {
      const findings = secretFindings(path, readFileSync(resolve(root, path), 'utf8'));
      if (findings.length)
        throw new Error(`Secret review blocked ${path}: ${findings.join(', ')}. Values omitted.`);
    }
  }
  const unknown = changedPaths().filter((path) => !paths.has(path));
  if (unknown.length) throw new Error(`Changes not covered by the plan: ${unknown.join(', ')}`);
  return { plan, hash: digest(Buffer.from(raw, 'utf8')) };
}

// Patches intentionally replace one entire, small shared file with exact before/
// after hashes. No fuzzy hunk selection or working-tree mutation is performed.
export function applyVerifiedPatch(before, patchText, specification) {
  if (typeof before !== 'string')
    throw new Error(`Patch baseline is unavailable: ${specification.path}`);
  if (digest(normalize(before)) !== specification.before)
    throw new Error(`Patch baseline differs: ${specification.path}`);
  const lines = normalize(patchText).split('\n');
  const start = lines.findIndex((line) => line.startsWith('@@ '));
  if (start < 0 || lines.slice(start + 1).some((line) => line.startsWith('@@ ')))
    throw new Error('Expected one complete-file patch hunk.');
  const content =
    lines
      .slice(start + 1)
      .filter((line) => line.startsWith('+') || line.startsWith(' '))
      .map((line) => line.slice(1))
      .join('\n') + '\n';
  if (digest(content) !== specification.after)
    throw new Error(`Patch output differs: ${specification.path}`);
  return content;
}
function tree(index) {
  const entries = index
    ? git(['ls-files', '--stage', '-z'])
        .toString('utf8')
        .split('\0')
        .filter(Boolean)
        .map((line) => {
          const [metadata, path] = line.split('\t');
          const [mode, hash, stage] = metadata.split(' ');
          if (stage !== '0') throw new Error('Unmerged index entries.');
          return { mode, hash, path };
        })
    : git(['ls-tree', '-r', '-z', 'HEAD'])
        .toString('utf8')
        .split('\0')
        .filter(Boolean)
        .map((line) => {
          const [metadata, path] = line.split('\t');
          const [mode, , hash] = metadata.split(' ');
          return { mode, hash, path };
        });
  const sourceEntries = entries.filter((entry) =>
    /\.(?:[cm]?[jt]sx?|json|ya?ml)$/.test(entry.path),
  );
  const hashes = [...new Set(sourceEntries.map((entry) => entry.hash))];
  const output = git(['cat-file', '--batch'], { input: hashes.join('\n') + '\n' });
  let offset = 0;
  const blobs = new Map();
  for (const expected of hashes) {
    const end = output.indexOf(10, offset);
    const [hash, type, length] = output.subarray(offset, end).toString().split(' ');
    if (hash !== expected || type !== 'blob') throw new Error('Invalid Git blob response.');
    offset = end + 1;
    blobs.set(hash, output.subarray(offset, offset + Number(length)).toString('utf8'));
    offset += Number(length) + 1;
  }
  return new Map(entries.map((entry) => [entry.path, blobs.get(entry.hash) ?? null]));
}
function canonical(path) {
  try {
    return realpathSync.native(path).replaceAll('\\', '/').toLowerCase();
  } catch {
    return resolve(path).replaceAll('\\', '/').toLowerCase();
  }
}
export function checkTypes(files) {
  const mapped = new Map([...files].map(([path, text]) => [canonical(resolve(root, path)), text]));
  const rootKey = canonical(root) + '/';
  const read = (path) => {
    const key = canonical(path);
    if (mapped.has(key)) return mapped.get(key) ?? undefined;
    const dependency =
      !key.startsWith(rootKey) ||
      key.includes('/node_modules/') ||
      key.startsWith(rootKey + 'apps/api/src/generated/prisma/') ||
      key.startsWith(rootKey + 'apps/api/dist/');
    return dependency ? ts.sys.readFile(path) : undefined;
  };
  const exists = (path) => mapped.has(canonical(path)) || read(path) !== undefined;
  const projects = [
    ['packages/shared/tsconfig.json', (p) => p.startsWith('packages/shared/src/')],
    ['apps/api/tsconfig.json', (p) => p.startsWith('apps/api/src/')],
    [
      'apps/mobile/tsconfig.json',
      (p) => p.startsWith('apps/mobile/src/') || p.startsWith('apps/mobile/app/'),
    ],
    ['tests/tsconfig.json', (p) => /^tests\/[^/]+\.ts$/.test(p)],
  ];
  for (const [config, includes] of projects) {
    const configPath = resolve(root, config);
    const json = ts.readConfigFile(configPath, read);
    if (json.error) throw new Error(`Cannot read candidate config: ${config}`);
    const parsed = ts.parseJsonConfigFileContent(
      json.config,
      { ...ts.sys, readFile: read, fileExists: exists },
      dirname(configPath),
      { noEmit: true, incremental: false, composite: false, allowImportingTsExtensions: true },
      configPath,
    );
    const names = [...files.keys()]
      .filter((path) => includes(path) && /\.tsx?$/.test(path))
      .map((path) => resolve(root, path));
    const host = ts.createCompilerHost(parsed.options);
    host.readFile = read;
    host.fileExists = exists;
    host.getSourceFile = (path, languageVersion) => {
      const text = read(path);
      return text === undefined ? undefined : ts.createSourceFile(path, text, languageVersion);
    };
    const program = ts.createProgram(names, parsed.options, host);
    const diagnostics = ts.getPreEmitDiagnostics(program);
    if (diagnostics.length) {
      // Diagnostic text contains types and source locations, never source rows.
      console.error(
        ts.formatDiagnostics(diagnostics, {
          getCanonicalFileName: (p) => p,
          getCurrentDirectory: () => root,
          getNewLine: () => '\n',
        }),
      );
      throw new Error(`Candidate TypeScript check failed: ${config}`);
    }
  }
}
export function verifyStagedFiles(plan, unit) {
  const allowed = new Set([...unit.files, ...(unit.patches ?? []).map((patch) => patch.path)]);
  const staged = git(['diff', '--cached', '--no-renames', '--name-only', '-z'])
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
  if (!staged.length || staged.length !== allowed.size || staged.some((path) => !allowed.has(path)))
    throw new Error('Unexpected or empty staged file set. Preserve the index and review it.');
  for (const path of staged) {
    const patch = (unit.patches ?? []).find((item) => item.path === path);
    const expected = patch
      ? patch.after
      : path === planPath
        ? fingerprint(path)
        : plan.fingerprints[path];
    const deletion = git(['ls-files', '--stage', '--', path]).length === 0;
    if (deletion) {
      if (expected !== null) throw new Error(`Unexpected staged deletion: ${path}`);
      continue;
    }
    const buffer = git(['show', `:${path}`]);
    const actual = digest(extname(path) === '.png' ? buffer : normalize(buffer.toString('utf8')));
    if (actual !== expected) throw new Error(`Staged content differs: ${path}`);
    if (extname(path) !== '.png' && secretFindings(path, buffer.toString('utf8')).length)
      throw new Error(`Staged secret review blocked ${path}. Values omitted.`);
  }
}

async function main() {
  const [mode = 'audit', id] = process.argv.slice(2);
  const { plan, hash } = loadPlan();
  if (mode === 'audit') {
    console.log(
      JSON.stringify(
        {
          hash,
          base: plan.base,
          branch: plan.branch,
          units: plan.units.map(({ id, message, files, patches, tests }) => ({
            id,
            message,
            files,
            patches,
            tests,
          })),
        },
        null,
        2,
      ),
    );
  } else if (mode === 'staged' || mode === 'verify') {
    const unit = plan.units.find((item) => item.id === id);
    if (!unit) throw new Error('Unknown publication unit.');
    verifyStagedFiles(plan, unit);
    if (mode === 'staged') checkTypes(tree(true));
    console.log(
      mode === 'staged'
        ? 'Exact staged TypeScript candidate passed.'
        : 'Staged fingerprints and secret review passed.',
    );
  } else if (mode === 'simulate') {
    const files = tree(false);
    for (const unit of plan.units) {
      for (const path of unit.files) {
        if (existsSync(resolve(root, path)))
          files.set(
            path,
            /\.(?:[cm]?[jt]sx?|json)$/.test(path)
              ? readFileSync(resolve(root, path), 'utf8')
              : null,
          );
        else files.delete(path);
      }
      for (const patch of unit.patches ?? [])
        files.set(
          patch.path,
          applyVerifiedPatch(
            files.get(patch.path),
            readFileSync(resolve(root, patch.file), 'utf8'),
            patch,
          ),
        );
      checkTypes(files);
      console.log(`Candidate passed: ${unit.id}`);
    }
  } else throw new Error('Use audit, staged <unit>, or simulate.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
