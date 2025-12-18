/**
 * Credentials File Service
 *
 * Encrypts/decrypts credentials to/from a binary file format
 * Compatible with Olimpo.CredentialsManager in the Desktop client.
 *
 * File format:
 *   Magic (4 bytes): "HUSH"
 *   Version (4 bytes): int32 LE = 1
 *   Salt (16 bytes): random salt for PBKDF2
 *   Nonce (12 bytes): random nonce for AES-GCM
 *   Ciphertext (variable): JSON data encrypted with AES-256-GCM
 */

// Constants matching C# CredentialsFileService
const MAGIC_NUMBER = new TextEncoder().encode('HUSH');  // 4 bytes
const FILE_VERSION = 1;
const SALT_SIZE = 16;
const NONCE_SIZE = 12;
const AES_KEY_SIZE = 32;  // 256 bits
const PBKDF2_ITERATIONS = 100_000;
const GCM_TAG_SIZE = 128;  // bits

/**
 * Portable credentials structure - matches C# PortableCredentials
 */
export interface PortableCredentials {
  ProfileName: string;
  PublicSigningAddress: string;
  PrivateSigningKey: string;
  PublicEncryptAddress: string;
  PrivateEncryptKey: string;
  IsPublic: boolean;
  Mnemonic: string | null;
}

/**
 * Derive AES key from password using PBKDF2
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  // Import password as raw key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive AES-256-GCM key using PBKDF2
  // Convert Uint8Array to ArrayBuffer for TypeScript compatibility
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: AES_KEY_SIZE * 8 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Write a 32-bit integer as little-endian bytes
 */
function writeInt32LE(value: number): Uint8Array {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setInt32(0, value, true);  // true = little-endian
  return new Uint8Array(buffer);
}

/**
 * Read a 32-bit integer from little-endian bytes
 */
function readInt32LE(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, 4);
  return view.getInt32(0, true);  // true = little-endian
}

/**
 * Export credentials to an encrypted binary file
 * @param credentials The credentials to export
 * @param password The password to encrypt with
 * @returns Binary data ready to be saved as a .dat file
 */
export async function exportToEncryptedBytes(
  credentials: PortableCredentials,
  password: string
): Promise<Uint8Array> {
  // Generate random salt and nonce
  const salt = new Uint8Array(SALT_SIZE);
  const nonce = new Uint8Array(NONCE_SIZE);
  crypto.getRandomValues(salt);
  crypto.getRandomValues(nonce);

  // Derive encryption key from password
  const aesKey = await deriveKey(password, salt);

  // Serialize credentials to JSON
  const jsonData = JSON.stringify(credentials);
  const plaintext = new TextEncoder().encode(jsonData);

  // Encrypt with AES-256-GCM
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: GCM_TAG_SIZE },
    aesKey,
    plaintext
  );

  // Assemble file: Magic + Version + Salt + Nonce + Ciphertext
  const versionBytes = writeInt32LE(FILE_VERSION);
  const ciphertextBytes = new Uint8Array(ciphertext);

  const totalLength =
    MAGIC_NUMBER.length +      // 4 bytes
    versionBytes.length +      // 4 bytes
    salt.length +              // 16 bytes
    nonce.length +             // 12 bytes
    ciphertextBytes.length;    // variable

  const result = new Uint8Array(totalLength);
  let offset = 0;

  result.set(MAGIC_NUMBER, offset);
  offset += MAGIC_NUMBER.length;

  result.set(versionBytes, offset);
  offset += versionBytes.length;

  result.set(salt, offset);
  offset += salt.length;

  result.set(nonce, offset);
  offset += nonce.length;

  result.set(ciphertextBytes, offset);

  return result;
}

/**
 * Import credentials from an encrypted binary file
 * @param encryptedData The encrypted file data
 * @param password The password to decrypt with
 * @returns The decrypted credentials
 * @throws Error if file format is invalid or password is wrong
 */
export async function importFromEncryptedBytes(
  encryptedData: Uint8Array,
  password: string
): Promise<PortableCredentials> {
  let offset = 0;

  // Validate magic number
  const magic = encryptedData.slice(offset, offset + 4);
  offset += 4;

  if (!magic.every((byte, i) => byte === MAGIC_NUMBER[i])) {
    throw new Error('Invalid file format: missing HUSH magic number');
  }

  // Read and validate version
  const versionBytes = encryptedData.slice(offset, offset + 4);
  offset += 4;
  const version = readInt32LE(versionBytes);

  if (version !== FILE_VERSION) {
    throw new Error(`Unsupported file version: ${version}`);
  }

  // Extract salt, nonce, and ciphertext
  const salt = encryptedData.slice(offset, offset + SALT_SIZE);
  offset += SALT_SIZE;

  const nonce = encryptedData.slice(offset, offset + NONCE_SIZE);
  offset += NONCE_SIZE;

  const ciphertext = encryptedData.slice(offset);

  // Derive decryption key from password
  const aesKey = await deriveKey(password, salt);

  // Decrypt
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce, tagLength: GCM_TAG_SIZE },
      aesKey,
      ciphertext
    );

    const jsonData = new TextDecoder().decode(plaintext);
    return JSON.parse(jsonData) as PortableCredentials;
  } catch {
    throw new Error('Decryption failed: incorrect password or corrupted file');
  }
}

/**
 * Download credentials as an encrypted .dat file
 * @param credentials The credentials to download
 * @param password The password to encrypt with
 * @param filename The filename (without extension)
 */
export async function downloadCredentialsFile(
  credentials: PortableCredentials,
  password: string,
  filename: string
): Promise<void> {
  const encryptedData = await exportToEncryptedBytes(credentials, password);

  // Create blob and download
  // Convert Uint8Array to ArrayBuffer for Blob constructor
  const arrayBuffer = encryptedData.buffer.slice(
    encryptedData.byteOffset,
    encryptedData.byteOffset + encryptedData.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename} keys.dat`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
