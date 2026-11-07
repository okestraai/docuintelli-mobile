import { isValidPhoneNumber } from 'libphonenumber-js/max';

export const BAD_PHONE_MESSAGE = 'Enter a valid phone number for the selected country';

// Empty is fine here; a form that requires a number says so itself. A number already saved stays allowed.
export function phoneError(phone: string, saved?: string | null): string | undefined {
  if (!phone || phone === saved || isValidPhoneNumber(phone)) return undefined;
  return BAD_PHONE_MESSAGE;
}
