// Cashiers sign in with two codes instead of an email address.
// The codes map deterministically onto a real backend account, so every sale
// is attributed to that cashier and the usual security rules still apply.

export const MANAGER_EMAIL = "codedevelopers151@gmail.com";
export const CASHIER_EMAIL_DOMAIN = "cashier.tillpoint.app";

export function normalizeCode1(code1: string): string {
  return code1.trim().toUpperCase();
}

export function cashierEmail(code1: string): string {
  const slug = normalizeCode1(code1)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return `${slug}@${CASHIER_EMAIL_DOMAIN}`;
}

/** Code 2 is the secret; padded so it always satisfies the password policy. */
export function cashierPassword(code2: string): string {
  return `${code2.trim()}#Till1`;
}
