export type PlainMessage = {
  encrypted: false;
  text: string;
  version: 1;
};

export type EncryptedMessage = {
  encrypted: true;
  kdf: "PBKDF2";
  hash: "SHA-256";
  iterations: number;
  salt_b64: string;
  iv_b64: string;
  ciphertext_b64: string;
  version: 1;
};

export type StoredMessage = PlainMessage | EncryptedMessage;
