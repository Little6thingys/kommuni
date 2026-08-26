export function encryptExportPayload(plainText: string, secret: string): string {
  const bytes = new TextEncoder().encode(plainText);
  const keyBytes = new TextEncoder().encode(secret);
  const xored = new Uint8Array(bytes.length);

  for (let i = 0; i < bytes.length; i += 1) {
    xored[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
  }

  return btoa(String.fromCharCode(...xored));
}

export function decryptExportPayload(cipherText: string, secret: string): string {
  const raw = atob(cipherText);
  const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0));
  const keyBytes = new TextEncoder().encode(secret);
  const plain = new Uint8Array(bytes.length);

  for (let i = 0; i < bytes.length; i += 1) {
    plain[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
  }

  return new TextDecoder().decode(plain);
}
