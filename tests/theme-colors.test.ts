import { test } from 'node:test';
import assert from 'node:assert/strict';
import { palettes } from '../apps/mobile/src/theme-colors.ts';

function luminance(hex: string) {
  const channels = [1, 3, 5].map(
    (offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255,
  );
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  const [red = 0, green = 0, blue = 0] = linear;
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrast(foreground: string, background: string) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  const [lighter = 0, darker = 0] = values;
  return (lighter + 0.05) / (darker + 0.05);
}

test('positive and expense chart series use orange and theme-safe neutrals', () => {
  assert.equal(palettes.light.positive, '#C84A01');
  assert.equal(palettes.dark.positive, '#C84A01');
  assert.equal(palettes.light.expenseSeries, '#454B46');
  assert.equal(palettes.dark.expenseSeries, '#F5F5F5');
  assert.equal(palettes.light.negative, '#172019');
  assert.equal(palettes.dark.negative, '#F5F5F5');
});

test('solid negative text keeps readable contrast on its theme surfaces', () => {
  for (const surface of ['#F2EFE9', '#FAF8F4']) {
    assert.ok(contrast(palettes.light.negative, surface) >= 4.5);
  }
  for (const surface of ['#0A0A0A', '#101010', '#141414', '#1C1C1C']) {
    assert.ok(contrast(palettes.dark.negative, surface) >= 4.5);
  }
});

test('orange positive labels retain readable contrast in both themes', () => {
  assert.equal(palettes.light.accent, '#C84A01');
  assert.equal(palettes.dark.accent, '#C84A01');
  assert.equal(palettes.light.accentStrong, '#E45A12');
  assert.equal(palettes.dark.accentStrong, '#E45A12');
  for (const surface of ['#F2EFE9', '#FAF8F4', '#EAE5DC']) {
    assert.ok(contrast(palettes.light.positiveText, surface) >= 4.5);
  }
  for (const surface of ['#0A0A0A', '#101010', '#141414', '#1C1C1C']) {
    assert.ok(contrast(palettes.dark.positiveText, surface) >= 4.5);
  }
});

test('alerts no longer use separate traffic-light colors', () => {
  assert.equal(palettes.light.warning, palettes.light.accentText);
  assert.equal(palettes.light.danger, palettes.light.accentText);
  assert.equal(palettes.dark.warning, palettes.dark.accentText);
  assert.equal(palettes.dark.danger, palettes.dark.accentText);
});

test('orange labels and primary button text keep readable contrast in both themes', () => {
  for (const surface of ['#F2EFE9', '#FAF8F4']) {
    assert.ok(contrast(palettes.light.accentText, surface) >= 4.5);
  }
  for (const surface of ['#0A0A0A', '#101010', '#141414', '#1C1C1C']) {
    assert.ok(contrast(palettes.dark.accentText, surface) >= 4.5);
  }
  assert.ok(contrast(palettes.light.accentInk, palettes.light.accent) >= 4.5);
  assert.ok(contrast(palettes.dark.accentInk, palettes.dark.accent) >= 4.5);
});
