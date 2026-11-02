import {
  getPasswordLengthError,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from './passwordValidation';

describe('password validation', () => {
  test('requires at least ten characters', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(10);
    expect(getPasswordLengthError('123456789')).toBe('Use at least 10 characters.');
    expect(getPasswordLengthError('1234567890')).toBe('');
  });

  test('retains the bcrypt-compatible maximum', () => {
    expect(getPasswordLengthError('a'.repeat(PASSWORD_MAX_LENGTH))).toBe('');
    expect(getPasswordLengthError('a'.repeat(PASSWORD_MAX_LENGTH + 1))).toBe('Use no more than 72 characters.');
  });
});
