import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BadRequestException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
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

test('HTTP server errors are sanitized while validation errors remain actionable', () => {
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
  const filter = new DatabaseErrorFilter();
  filter.catch(new InternalServerErrorException('password=secret SQL'), host);
  assert.equal(status, 500);
  assert.deepEqual(body, { statusCode: 500, message: 'The request could not be completed.' });
  filter.catch(new BadRequestException('Invalid date.'), host);
  assert.equal(status, 400);
  assert.equal(body.message, 'Invalid date.');
  filter.catch(
    new ServiceUnavailableException({
      service: 'fintrack-api',
      scope: 'database',
      status: 'unavailable',
      password: 'secret',
    }),
    host,
  );
  assert.equal(status, 503);
  assert.deepEqual(body, { service: 'fintrack-api', scope: 'database', status: 'unavailable' });
});
