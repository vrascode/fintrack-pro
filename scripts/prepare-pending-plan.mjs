// Prepare a reviewable snapshot, not commits. No Git write command is used here.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { digest, fingerprint, root, changedPaths, planPath } from './publish-pending-check.mjs';
import { format, resolveConfig } from 'prettier';

const base = '22f7e30ac8324dda07e8aac426b825a29228b131';
const normalize = (text) => text.replace(/^\uFEFF/, '').replaceAll('\r\n', '\n');
const head = (path) =>
  normalize(execFileSync('git', ['show', `${base}:${path}`], { cwd: root, encoding: 'utf8' }));
mkdirSync(resolve(root, 'scripts/publish-patches'), { recursive: true });
function patch(name, path, before, after) {
  if (before === after || !before.endsWith('\n') || !after.endsWith('\n'))
    throw new Error('Expected a real, complete text patch.');
  const oldLines = before.slice(0, -1).split('\n');
  const newLines = after.slice(0, -1).split('\n');
  const file = `scripts/publish-patches/${name}.patch`;
  writeFileSync(
    resolve(root, file),
    `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1,${oldLines.length} +1,${newLines.length} @@\n${oldLines.map((line) => '-' + line).join('\n')}\n${newLines.map((line) => '+' + line).join('\n')}\n`,
  );
  return { path, file, before: digest(before), after: digest(after) };
}
const app = head('apps/api/src/app.ts');
const withFilter = app
  .replace(
    "import { webOrigins } from './identity/web-session.js';",
    "import { webOrigins } from './identity/web-session.js';\nimport { DatabaseErrorFilter } from './database/database-error.filter.js';",
  )
  .replace(
    "  app.setGlobalPrefix('v1');",
    "  app.setGlobalPrefix('v1');\n  app.useGlobalFilters(new DatabaseErrorFilter());",
  );
const withCors = withFilter
  .replace(
    "import { webOrigins } from './identity/web-session.js';",
    "import { createCorsOptions } from './config/cors.js';",
  )
  .replace(
    'app.enableCors({ origin: webOrigins(), credentials: true });',
    'app.enableCors(createCorsOptions());',
  );
if (normalize(readFileSync(resolve(root, 'apps/api/src/app.ts'), 'utf8')) !== withCors)
  throw new Error('Shared app.ts differs; review its patches explicitly.');
const filterPatch = patch('02-database-filter-app', 'apps/api/src/app.ts', app, withFilter);
const corsPatch = patch('03-cors-app', 'apps/api/src/app.ts', withFilter, withCors);
const pkg = head('package.json');
const withRecovery = pkg.replace(
  '    "test:e2e:isolated": "node scripts/test-isolated-postgres.mjs",',
  '    "test:e2e:isolated": "node scripts/test-isolated-postgres.mjs",\n    "test:postgres-recovery": "node scripts/test-isolated-postgres.mjs --recovery-only",',
);
const withExpo = withRecovery
  .replace(
    '"mobile": "npm run start -w @fintrack/mobile"',
    '"mobile": "node scripts/expo.mjs start"',
  )
  .replace(
    '"web": "npm run web -w @fintrack/mobile"',
    '"web": "node scripts/expo.mjs start --web"',
  );
if (normalize(readFileSync(resolve(root, 'package.json'), 'utf8')) !== withExpo)
  throw new Error('Shared package.json differs; review its patches explicitly.');
const recoveryPatch = patch('07-postgres-package', 'package.json', pkg, withRecovery);
const expoPatch = patch('08-expo-package', 'package.json', withRecovery, withExpo);
const foundation = head('e2e/foundation.spec.ts');
const onboarding = head('e2e/onboarding.spec.ts');
const fixtureImport = (text) =>
  text.replace(
    "import { test, expect } from '@playwright/test';",
    "import { test, expect } from './fixtures';",
  );
const foundationPatch = patch(
  '09-foundation-fixture',
  'e2e/foundation.spec.ts',
  foundation,
  fixtureImport(foundation),
);
const onboardingPatch = patch(
  '09-onboarding-fixture',
  'e2e/onboarding.spec.ts',
  onboarding,
  fixtureImport(onboarding),
);
const ci = head('.github/workflows/ci.yml');
const withFixtureUrl = ci.replace(
  '      - name: Build Android, iOS, and web bundles\n        run: npm run bundle',
  '      - name: Build Android, iOS, and web bundles\n        run: npm run bundle\n        env:\n          EXPO_PUBLIC_API_URL: https://api.example.test/v1 # Browser tests intercept requests; never uses a real account.',
);
const fixtureCiPatch = patch(
  '09-browser-ci-fixture',
  '.github/workflows/ci.yml',
  ci,
  withFixtureUrl,
);
function unit(id, message, files, tests, patches = [], dependsOn = []) {
  return { id, message, files, patches, tests, dependsOn };
}
const units = [
  unit(
    '01-auth-limit',
    'fix(auth): limitar tentativas antes de consultar credenciais',
    [
      'apps/api/src/identity/auth-rate-limit.guard.ts',
      'apps/api/src/identity/auth.controller.ts',
      'apps/api/src/identity/auth.module.ts',
      'tests/auth-endpoints.test.mjs',
    ],
    ['auth'],
  ),
  unit(
    '02-database-errors',
    'fix(api): responder falhas de banco sem expor dados sensíveis',
    ['apps/api/src/database/database-error.filter.ts', 'tests/database-error.test.mjs'],
    ['database'],
    [filterPatch],
  ),
  unit(
    '03-cors',
    'fix(api): compartilhar política segura de origem com autenticação',
    ['apps/api/src/config/cors.ts', 'apps/api/src/identity/web-session.ts', 'tests/cors.test.mjs'],
    ['cors'],
    [corsPatch],
    ['02-database-errors'],
  ),
  unit(
    '04-database-utc',
    'fix(database): preservar instantes de sessão em conexões UTC',
    [
      'apps/api/src/database/adapter.ts',
      'apps/api/src/database/prisma.service.ts',
      'scripts/database.mjs',
      'tests/integration/identity.test.mjs',
      'tests/integration/ledger.test.mjs',
      'tests/integration/database-timezone.test.mjs',
    ],
    ['auth', 'cors'],
  ),
  unit(
    '05-accounts',
    'feat(accounts): atualizar metadados e preservar contas arquivadas',
    [
      'packages/shared/src/finance.ts',
      'apps/api/src/accounts/accounts.controller.ts',
      'apps/api/src/accounts/accounts.service.ts',
      'tests/accounts-api.test.mjs',
    ],
    ['accounts'],
  ),
  unit(
    '06-transactions',
    'feat(transactions): consultar histórico e detalhes com isolamento',
    [
      'apps/api/src/transactions/transactions.controller.ts',
      'apps/api/src/transactions/transactions.service.ts',
      'tests/transactions-api.test.mjs',
    ],
    ['transactions'],
  ),
  unit(
    '07-postgres-tools',
    'fix(database): proteger auditoria recuperação e aceite PostgreSQL local',
    [
      'scripts/recover-postgres-admin.mjs',
      'scripts/setup-local-postgres.mjs',
      'scripts/test-isolated-postgres.mjs',
      'tests/postgres-recovery.test.mjs',
      'tests/postgres-setup.test.mjs',
      'tests/integration/postgres-recovery.test.mjs',
      'docs/postgresql-recovery-approval.md',
      'docs/postgresql-local-credentials.md',
    ],
    ['postgres'],
    [recoveryPatch],
  ),
  unit(
    '08-expo',
    'fix(expo): carregar URL pública do monorepo e preservar argumentos',
    ['scripts/expo.mjs', 'apps/mobile/package.json', 'tests/expo-environment.test.mjs'],
    ['environment'],
    [expoPatch],
    ['07-postgres-tools'],
  ),
  unit(
    '09-browser-fixtures',
    'test(web): isolar requisições e configurar URL de teste na CI',
    ['e2e/fixtures.ts'],
    ['browser'],
    [foundationPatch, onboardingPatch, fixtureCiPatch],
    ['08-expo'],
  ),
  unit(
    '10-development',
    'fix(dev): iniciar Expo no workspace e diagnosticar destinos locais',
    ['scripts/dev.mjs', 'scripts/doctor.mjs', 'scripts/inspect-local-blockers.ps1'],
    ['environment', 'postgres'],
    [],
    ['08-expo'],
  ),
  unit(
    '11-http-session',
    'fix(mobile): preservar sessão e distinguir falhas HTTP e de conexão',
    [
      'apps/mobile/src/api/client.ts',
      'apps/mobile/src/api/url.ts',
      'apps/mobile/src/api/transport.ts',
      'apps/mobile/src/auth/core.ts',
      'apps/mobile/src/auth/index.ts',
      'tests/api-url.test.ts',
      'tests/auth-store.test.ts',
      'tests/http-client.test.ts',
    ],
    ['transport', 'environment'],
    [],
    ['05-accounts', '08-expo', '09-browser-fixtures'],
  ),
  unit(
    '12-theme',
    'style(theme): alinhar identidade laranja e superfícies escuras',
    [
      'apps/mobile/src/theme.ts',
      'apps/mobile/src/theme.tsx',
      'apps/mobile/src/theme-colors.ts',
      'tests/theme-colors.test.ts',
    ],
    ['theme'],
  ),
  unit(
    '13-auth-ui',
    'feat(auth): apresentar login e cadastro responsivos e acessíveis',
    [
      'apps/mobile/src/components/ui.tsx',
      'apps/mobile/src/auth/layout.tsx',
      'apps/mobile/src/auth/PasswordField.tsx',
      'apps/mobile/src/auth/useReducedMotion.ts',
      'apps/mobile/app/login.tsx',
      'e2e/auth-design.spec.ts',
      'e2e/foundation.spec.ts',
      'e2e/onboarding.spec.ts',
    ],
    ['browser'],
    [],
    ['11-http-session', '12-theme'],
  ),
  unit(
    '14-personal-finance',
    'feat(finance): editar contas e consultar movimentações persistidas',
    [
      'apps/mobile/src/personal/screens.tsx',
      'apps/mobile/app/(tabs)/activity.tsx',
      'e2e/real/financial.spec.ts',
    ],
    ['accounts', 'transactions', 'transport'],
    [],
    ['05-accounts', '06-transactions', '11-http-session', '13-auth-ui'],
  ),
  unit(
    '15-ci',
    'ci: validar integração PostgreSQL e interface com ambiente isolado',
    ['.github/workflows/ci.yml', 'scripts/ci-postgres.mjs', 'tsconfig.json'],
    ['lint', 'types'],
    [],
    ['04-database-utc', '13-auth-ui'],
  ),
  unit(
    '16-real-smoke',
    'test(auth): verificar autenticação e finanças reais sem apagar registros',
    ['scripts/validate-local-auth.mjs'],
    ['auth', 'accounts', 'transactions'],
    [],
    ['14-personal-finance'],
  ),
  unit(
    '17-screenshots',
    'docs(auth): capturar telas reais de login e cadastro',
    [
      'scripts/capture-auth-screenshots.mjs',
      'docs/screenshots/auth-login-desktop.png',
      'docs/screenshots/auth-login-mobile.png',
      'docs/screenshots/auth-register-desktop.png',
      'docs/screenshots/auth-register-mobile.png',
    ],
    ['lint'],
    [],
    ['13-auth-ui'],
  ),
  unit(
    '18-documentation',
    'docs(project): registrar produto execução e validação em dois idiomas',
    [
      '.env.example',
      'README.md',
      'README.pt-BR.md',
      'ARCHITECTURE.md',
      'DATABASE.md',
      'ROADMAP.md',
      'SECURITY.md',
      'PORTFOLIO_PROGRESS.md',
      'COMMITS.md',
      'docs/auth-redesign-plan.md',
      'docs/auth-redesign-validation.md',
      'docs/communication-repair-plan.md',
      'docs/local-development.md',
      'docs/validation-2026-10-31.md',
      'docs/validation-2026-11-02.md',
    ],
    ['format'],
    [],
    ['16-real-smoke', '17-screenshots'],
  ),
  unit(
    '19-publication',
    'feat(dev): publicar unidades verificadas com push e relatório individual',
    [
      'scripts/publish-pending-commits.ps1',
      'scripts/publish-pending-check.mjs',
      'scripts/prepare-pending-plan.mjs',
      planPath,
      filterPatch.file,
      corsPatch.file,
      recoveryPatch.file,
      expoPatch.file,
      foundationPatch.file,
      onboardingPatch.file,
      fixtureCiPatch.file,
      'tests/publish-pending.test.mjs',
      'docs/publishing.md',
      'docs/publication-preparation.md',
    ],
    ['publisher', 'format'],
    [],
    ['18-documentation'],
  ),
];
const paths = new Set(units.flatMap((item) => [...item.files, ...item.patches.map((p) => p.path)]));
const unknown = changedPaths().filter((path) => !paths.has(path));
if (unknown.length) throw new Error(`Unassigned changes need review: ${unknown.join(', ')}`);
const fingerprints = Object.fromEntries(
  [...paths]
    .sort()
    .filter((path) => path !== planPath)
    .map((path) => [path, fingerprint(path)]),
);
const serialized =
  JSON.stringify(
    {
      schema: 1,
      base,
      branch: 'main',
      remote: 'https://github.com/vrascode/fintrack-pro.git',
      units,
      fingerprints,
    },
    null,
    2,
  ) + '\n';
writeFileSync(
  resolve(root, planPath),
  await format(serialized, {
    ...(await resolveConfig(resolve(root, planPath))),
    filepath: resolve(root, planPath),
    parser: 'json',
  }),
);
console.log(
  'Prepared ' +
    units.length +
    ' real units and seven complete-file patches. No staging or commits.',
);
