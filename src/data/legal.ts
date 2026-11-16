// Impressum data (§ 5 DDG). Street and postal code stay empty until Samuel has a c/o (Impressum service) address.
export const legal = {
  name: 'Samuel Castillo Glantz',
  street: '',
  postalCode: '',
  city: 'Berlin',
  country: 'Germany',
  email: 'samuel.c.glantz@gmail.com',
};

// Street and postal code are optional until a c/o address exists; name, city, country and email are always required.
const required = ['name', 'city', 'country', 'email'] as const;
const missing = required.filter((k) => !legal[k].trim());

/** A production deploy must never ship an incomplete Impressum. */
if (missing.length > 0 && process.env.VERCEL_ENV === 'production') {
  throw new Error(`Impressum incomplete, missing: ${missing.join(', ')}. Fill in src/data/legal.ts.`);
}

export const legalComplete = missing.length === 0;
