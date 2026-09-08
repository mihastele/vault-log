export interface EncryptedPayload {
  version: 1;
  salt: string;
  iv: string;
  data: string;
}

const PBKDF2_ITERATIONS = 200_000;
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

function getCrypto(): Crypto {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi) {
    throw new Error("Web Crypto API is unavailable in this environment.");
  }
  return cryptoApi;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const clean = hex.replace(/^0x/i, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    out[i / 2] = Number.parseInt(clean.slice(i, i + 2), 16);
  }
  return out as Uint8Array<ArrayBuffer>;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return globalThis.btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = globalThis.atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out as Uint8Array<ArrayBuffer>;
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const keyMaterial = await getCrypto().subtle.importKey(
    "raw",
    TEXT_ENCODER.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  return getCrypto().subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptValue(value: string, passphrase: string): Promise<string> {
  const salt = new Uint8Array(16);
  const iv = new Uint8Array(12);
  getCrypto().getRandomValues(salt);
  getCrypto().getRandomValues(iv);
  const key = await deriveKey(passphrase, salt as Uint8Array<ArrayBuffer>);
  const encrypted = await getCrypto().subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    TEXT_ENCODER.encode(value),
  );

  const payload: EncryptedPayload = {
    version: 1,
    salt: bytesToHex(salt),
    iv: bytesToHex(iv),
    data: bytesToBase64(new Uint8Array(encrypted)),
  };

  return JSON.stringify(payload);
}

export async function decryptValue(payloadJson: string, passphrase: string): Promise<string> {
  const parsed = JSON.parse(payloadJson) as Partial<EncryptedPayload>;
  if (!parsed || parsed.version !== 1 || typeof parsed.salt !== "string" || typeof parsed.iv !== "string" || typeof parsed.data !== "string") {
    throw new Error("Vault payload is not encrypted with the current vault format.");
  }

  const key = await deriveKey(passphrase, hexToBytes(parsed.salt));
  const plaintext = await getCrypto().subtle.decrypt(
    { name: "AES-GCM", iv: hexToBytes(parsed.iv) as BufferSource },
    key,
    base64ToBytes(parsed.data) as BufferSource,
  );

  return TEXT_DECODER.decode(plaintext);
}

export function isEncryptedValue(value: string): boolean {
  if (!value || value[0] !== "{") return false;
  try {
    const parsed = JSON.parse(value) as Partial<EncryptedPayload>;
    return parsed.version === 1 && typeof parsed.data === "string" && typeof parsed.salt === "string" && typeof parsed.iv === "string";
  } catch {
    return false;
  }
}

export async function maybeDecryptValue(value: string, passphrase: string): Promise<string> {
  if (!isEncryptedValue(value)) return value;
  return decryptValue(value, passphrase);
}
