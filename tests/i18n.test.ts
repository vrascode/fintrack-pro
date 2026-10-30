import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCurrency, formatDate, translate } from '../apps/mobile/src/i18n/index.ts';

test('translations cover the dashboard and settings in both supported languages', () => {
  assert.equal(translate('pt-BR', 'nav.overview'), 'Visão geral');
  assert.equal(translate('en', 'nav.overview'), 'Overview');
  assert.equal(translate('pt-BR', 'home.noDataBadge'), 'DADOS FINANCEIROS NÃO CONECTADOS');
  assert.equal(translate('en', 'home.noDataBadge'), 'FINANCIAL DATA NOT CONNECTED');
});

test('currency formatting preserves cent precision and supports amount privacy', () => {
  assert.equal(formatCurrency(123456n, 'pt-BR'), 'R$ 1.234,56');
  assert.equal(formatCurrency(123456n, 'en'), 'R$1,234.56');
  assert.equal(formatCurrency(-1n, 'pt-BR'), '-R$ 0,01');
  assert.equal(formatCurrency(900719925474099312345n, 'pt-BR'), 'R$ 9.007.199.254.740.993.123,45');
  assert.equal(formatCurrency(123456n, 'en', 'BRL', true), '••••');
});

test('date formatting uses locale and treats civil dates consistently', () => {
  assert.equal(formatDate('2026-01-05', 'pt-BR'), '5 de jan. de 2026');
  assert.equal(formatDate('2026-01-05', 'en'), 'Jan 5, 2026');
  assert.throws(() => formatDate('not-a-date', 'en'), RangeError);
});
