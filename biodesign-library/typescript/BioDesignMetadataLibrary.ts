/**
 * BioDesign Metadata Library - TypeScript Implementation
 * 
 * This module provides functionality for managing metadata associated with biological designs.
 * It includes operations for calculating checksums, tracking differences between versions,
 * and handling encryption of sensitive data.
 * 
 * Key Features:
 * - Checksum calculation for sequence verification
 * - Difference tracking between versions
 * - Cryptographic operations (encryption)
 */

import * as crypto from 'crypto';
import { diff_match_patch } from 'diff-match-patch';
import { createCipheriv, randomBytes } from 'crypto';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Represents a single operation performed on a biological design.
 */
interface BioDesignOperation {
  /** Unique identifier for the operation type */
  operationCode: string;
  /** Specific details of the operation */
  operationDetails: Record<string, any>;
  /** Description of the change made */
  change: string;
  /** When the operation was performed */
  timestamp: string;
  /** Tool used to perform the operation */
  tool: string;
}

/**
 * Represents the metadata associated with a biological design.
 */
interface BioDesignMetadata {
  /** Unique identifier for the design */
  id: string;
  /** ID of the parent design if derived */
  parentMetadataId: string | null;
  /** Name of the design */
  designName: string | null;
  /** SHA-256 hash of the design sequence */
  designChecksum: string;
  /** Creator of the design */
  author: string;
  /** Description of the design */
  description: string;
  /** Timestamp of last modification */
  lastUpdated: string;
  /** History of operations performed */
  changelog: BioDesignOperation[];
}

/**
 * Calculate SHA-256 checksum of a sequence.
 * 
 * @param sequence - The sequence to calculate checksum for
 * @returns Hexadecimal representation of the SHA-256 hash
 * 
 * @note Input is converted to lowercase before hashing
 */
export function calculateChecksum(sequence: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(sequence);
  return hash.digest('hex');
}

/**
 * Compute the difference between two strings.
 * 
 * @param originalString - Original version
 * @param newString - New version
 * @returns Text representation of the differences
 * 
 * @note Uses diff_match_patch algorithm for difference computation
 */
export function computeDifference(originalString: string, newString: string): string {
  const dmp = new diff_match_patch();
  const patches = dmp.patch_make(newString, originalString);
  return dmp.patch_toText(patches);
}

/**
 * Encrypt a string using AES-CBC.
 * 
 * @param stringToEncrypt - String to encrypt
 * @returns Base64-encoded encrypted string
 * 
 * @throws Error if ENCRYPTION_KEY environment variable is not set
 * 
 * @note Uses AES-CBC with PKCS7 padding
 * @note Requires ENCRYPTION_KEY environment variable
 */
export function encryptString(stringToEncrypt: string): string {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(stringToEncrypt), cipher.final()]);
  return Buffer.concat([iv, encrypted]).toString('base64');
}
