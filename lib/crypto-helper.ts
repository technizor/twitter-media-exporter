import crypto from 'crypto';

const algo = 'aes-256-ctr';

// The code below sets the crypto key from your environment variables
const key = process.env.OAUTH_KEY!;

const hashKey = crypto.createHash('sha256').update(String(key)).digest('base64').substr(0, 32);

// #region Public Functions
export function encrypt(plaintext: Buffer): Buffer {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algo, hashKey, iv);
  return Buffer.concat([iv, cipher.update(plaintext), cipher.final()]);
}

export function decrypt(encrypted: Buffer): Buffer {
  const iv = encrypted.slice(0, 16);
  const ciphertext = encrypted.slice(16);
  const decipher = crypto.createDecipheriv(algo, hashKey, iv);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
// #endregion Public Functions
