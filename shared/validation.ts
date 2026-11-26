// Same rules as booking-api's request schema, so the form catches mistakes
// before the API does.

export const NAME = /^[\p{L}][\p{L} '\-]{0,49}$/u;
export const EMAIL = /^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$/;
export const PNR = /^[A-Za-z0-9]{6}$/;

export function nameError(value: string): string | null {
  const v = value.trim();
  if (!v) return "Required";
  return NAME.test(v) ? null : "Letters, spaces, hyphens and apostrophes only";
}

export function emailError(value: string): string | null {
  const v = value.trim();
  if (!v) return "Required";
  return EMAIL.test(v) ? null : "Enter a valid email address";
}
