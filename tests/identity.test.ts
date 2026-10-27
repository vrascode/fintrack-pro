import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loginSchema, passwordSchema, registerSchema } from '@fintrack/shared';
import { PasswordCapacityError, PasswordHasher } from '../apps/api/dist/identity/password.js';
import { issueToken, matchesToken, tokenDigest } from '../apps/api/dist/identity/tokens.js';

test('identity contracts normalize email and reject mass assignment without modifying passwords', () => {
  const password = '  a long phrase with spaces  ';
  assert.deepEqual(registerSchema.parse({ email: ' PERSON@EXAMPLE.TEST ', password }), {
    email: 'person@example.test',
    password,
  });
  assert.equal(registerSchema.safeParse({ email: 'bad', password }).success, false);
  assert.equal(
    registerSchema.safeParse({ email: 'person@example.test', password, role: 'admin' }).success,
    false,
  );
  assert.equal(
    loginSchema.safeParse({ email: 'person@example.test', password, deviceName: ' ' }).success,
    false,
  );
  assert.equal(passwordSchema.safeParse('too short').success, false);
  assert.equal(passwordSchema.safeParse('a'.repeat(129)).success, false);
  assert.equal(passwordSchema.safeParse('😀'.repeat(128)).success, true);
  assert.equal(passwordSchema.safeParse('😀'.repeat(129)).success, false);
  assert.equal(passwordSchema.safeParse('a'.repeat(15) + '\ud800').success, false);
  assert.equal(passwordSchema.safeParse('a'.repeat(15) + '\ufffd').success, true);
});

test('scrypt uses unique salts, verifies real hashes and rejects wrong or normalized passwords', async () => {
  const hasher = new PasswordHasher();
  const password = '  café password test phrase  ';
  const first = await hasher.hash(password);
  const second = await hasher.hash(password);
  assert.notEqual(first, second);
  assert.ok(first.startsWith('scrypt$131072$8$1$'));
  assert.equal(first.includes(password), false);
  assert.equal(await hasher.verify(password, first), true);
  assert.equal(await hasher.verify('a different test password', first), false);
  assert.equal(await hasher.verify(password.trim(), first), false);
  assert.equal(await hasher.verify(password.normalize('NFD'), first), false);
});

test('password verification fails closed for missing users, malformed hashes and unsafe work factors', async () => {
  const hasher = new PasswordHasher();
  const password = 'a sufficiently long test phrase';
  for (const encoded of [null, '', 'not-a-hash', 'scrypt$999999999$8$1$invalid$invalid']) {
    assert.equal(await hasher.verify(password, encoded), false);
  }
  assert.equal(await hasher.verify('short', null), false);
  await assert.rejects(hasher.hash('short'));
});

test('password hashing bounds concurrent memory use and recovers capacity', async () => {
  const hasher = new PasswordHasher(1);
  const first = hasher.hash('first password test phrase');
  await assert.rejects(hasher.hash('second password test phrase'), PasswordCapacityError);
  const encoded = await first;
  assert.equal(await hasher.verify('first password test phrase', encoded), true);
  assert.throws(() => new PasswordHasher(0), RangeError);
});

test('opaque tokens contain 256 random bits, store digests and separate purposes', () => {
  for (const purpose of ['access', 'refresh', 'verifyEmail', 'resetPassword'] as const) {
    const token = issueToken(purpose);
    assert.equal(token.value.length, 48);
    assert.match(token.hash, /^[a-f0-9]{64}$/);
    assert.equal(matchesToken(token.value, token.hash, purpose), true);
    assert.equal(matchesToken(issueToken(purpose).value, token.hash, purpose), false);
    assert.equal(matchesToken(token.value, '', purpose), false);
    assert.notEqual(token.value, token.hash);
  }
  const refresh = issueToken('refresh');
  assert.equal(tokenDigest(refresh.value, 'access'), null);
  assert.equal(tokenDigest(refresh.value + '=', 'refresh'), null);
  assert.equal(tokenDigest('ft_r_' + 'A'.repeat(42) + 'B', 'refresh'), null);
  assert.equal(tokenDigest('', 'refresh'), null);
});
