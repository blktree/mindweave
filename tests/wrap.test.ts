import { expect, test } from 'vitest';
import { normalizeWrap } from '../src/preferences';

test('wrap accepts values above 40, including 100', () => {
  for (const value of [40, 100, 200]) expect(normalizeWrap(String(value))).toBe(value);
});

test('wrap remains a valid positive integer', () => {
  expect(normalizeWrap(2)).toBe(6);
  expect(normalizeWrap(100.5)).toBe(100);
  for (const value of ['', undefined, 'bad', Infinity, -1]) expect(normalizeWrap(value)).toBe(20);
});
