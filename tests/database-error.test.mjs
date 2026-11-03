import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseErrorFilter } from '../apps/api/dist/database/database-error.filter.js';
test('database failures return 503 without leaking credentials or SQL', () => {
  let status, body;
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({
        status: (code) => {
          status = code;
          return {
            json: (value) => {
              body = value;
            },
          };
        },
      }),
    }),
  };
  const error = Object.assign(new Error('secret URL and SQL'), { code: 'P1000' });
  new DatabaseErrorFilter().catch(error, host);
  assert.equal(status, 503);
  assert.doesNotMatch(JSON.stringify(body), /secret|SQL/);
});
