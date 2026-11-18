// Stand-in for `password-hash-wasm/argon2id` in vitest, which can't load its
// WASM module. Only tests use it (see vitest.config.mts).

export async function hashPassword(password: string): Promise<string> {
  return `fake:${password}`;
}

export async function verifyPassword(
  password: string,
  phc: string,
): Promise<boolean> {
  return phc === `fake:${password}`;
}
