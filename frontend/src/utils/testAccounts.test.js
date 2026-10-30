import { hasTestControls } from './testAccounts';

test('enables controls for the configured test account', () => {
  expect(hasTestControls('ct.lopsan@gmail.com')).toBe(true);
  expect(hasTestControls(' CT.LOPSAN@gmail.com ')).toBe(true);
});

test('keeps controls hidden for every other account', () => {
  expect(hasTestControls('member@example.com')).toBe(false);
  expect(hasTestControls('')).toBe(false);
  expect(hasTestControls(null)).toBe(false);
});
