import * as Crypto from 'expo-crypto';

export async function newId(prefix: string): Promise<string> {
  // 12 bytes => 24 hex chars. Good enough for local IDs.
  const bytes = Crypto.getRandomBytes(12);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${prefix}_${hex}`;
}
