const crypto = require("crypto");

const ALGORITHM = "aes-256-cbc";
const KEY_LENGTH = 32; // 256 bits

/**
 * Derives a fixed-length 32-byte Buffer from the ENCRYPTION_KEY env variable.
 * Using a hash ensures the key is always exactly 32 bytes regardless of how
 * the user formatted it in .env.
 */
function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("ENCRYPTION_KEY is not set in environment variables.");
  }
  // SHA-256 of the raw string → always 32 bytes
  return crypto.createHash("sha256").update(raw).digest();
}

/**
 * Encrypts a plain-text string using AES-256-CBC.
 * Returns a single string in the format:  "<ivHex>:<encryptedHex>"
 *
 * @param {string} plainText
 * @returns {string}
 */
function encrypt(plainText) {
  const key = getKey();
  const iv = crypto.randomBytes(16); // fresh IV every time
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);

  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts a string previously produced by encrypt().
 * Expects the format:  "<ivHex>:<encryptedHex>"
 *
 * @param {string} payload
 * @returns {string}
 */
function decrypt(payload) {
  const [ivHex, encryptedHex] = payload.split(":");
  if (!ivHex || !encryptedHex) {
    throw new Error("Invalid encrypted payload format.");
  }

  const key = getKey();
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return decrypted.toString("utf8");
}

module.exports = { encrypt, decrypt };
