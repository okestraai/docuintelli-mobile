import { BAD_PHONE_MESSAGE, phoneError } from './phone';

describe('phoneError', () => {
  it.each(['+12025550123', '+2348031234567', '+447911123456'])('accepts %s', (phone) => {
    expect(phoneError(phone)).toBeUndefined();
  });

  it.each(['+11', '+15550101', '+23480'])('refuses %s', (phone) => {
    expect(phoneError(phone)).toBe(BAD_PHONE_MESSAGE);
  });

  it('lets an account keep a number it already has', () => {
    expect(phoneError('+15550101', '+15550101')).toBeUndefined();
  });

  it('leaves an empty number for the form to judge', () => {
    expect(phoneError('')).toBeUndefined();
  });
});
