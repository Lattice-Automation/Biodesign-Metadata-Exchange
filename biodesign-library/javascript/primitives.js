/**
 * BioDesign metadata primitives.
 *
 * - computeTextDiff, formatTimestamp, calculateChecksumAsync
 * - buildMetadata (builds standard metadata object)
 * - encryptStringAsync, decryptStringAsync, encryptMetadataAsync, decryptMetadataAsync
 */

import diff_match_patch from "diff-match-patch";

/**
 * Compute the diff (patch) from text before → after.
 * Returns the same format as NTI library: patch_toText(patch_make(after, before)).
 * @param {string} beforeText - Text before the operation
 * @param {string} afterText - Text after the operation
 * @returns {string} Patch text, or "" if no diff / error
 */
export function computeTextDiff(beforeText, afterText) {
  if (beforeText == null && afterText == null) return "";
  const before = typeof beforeText === "string" ? beforeText : "";
  const after = typeof afterText === "string" ? afterText : "";
  if (before === after) return "";
  try {
    const dmp = new diff_match_patch();
    const patches = dmp.patch_make(after, before);
    return dmp.patch_toText(patches);
  } catch {
    return "";
  }
}

/**
 * Format date as MM/DD/YYYY, HH:mm:ss (matches NTI library).
 * @param {Date} d
 * @returns {string}
 */
export function formatTimestamp(d) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const y = d.getFullYear();
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${m}/${day}/${y}, ${h}:${min}:${s}`;
}

/**
 * SHA-256 checksum of a sequence (lowercased), hex string. Uses Web Crypto; async.
 * @param {string} sequence
 * @returns {Promise<string>}
 */
export async function calculateChecksumAsync(sequence) {
  const normalized = (sequence || "").toLowerCase();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Build a BioDesign metadata object (same shape as NTI buildMetadata).
 * Async because checksum uses Web Crypto.
 *
 * @param {object} options
 * @param {string} [options.parentMetadataId] - Default ''
 * @param {string} options.designName
 * @param {string} [options.author] - Default ''
 * @param {string} [options.description] - Default ''
 * @param {string} [options.design] - Sequence string for checksum; default ''
 * @param {Array<object>} [options.changelog] - Default []
 * @param {string} [options.id] - Default crypto.randomUUID() or 'unknown-id'
 * @param {string} [options.lastUpdated] - Default now (formatTimestamp)
 * @returns {Promise<object>} { id, parentMetadataId, designName, designChecksum, author, description, lastUpdated, changelog }
 */
export async function buildMetadata(options = {}) {
  const {
    parentMetadataId = "",
    designName,
    author = "",
    description = "",
    design = "",
    changelog = [],
    id = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "unknown-id",
    lastUpdated = formatTimestamp(new Date())
  } = options;

  const designChecksum = await calculateChecksumAsync(design);

  return {
    id,
    parentMetadataId,
    designName,
    designChecksum,
    author,
    description,
    lastUpdated,
    changelog
  };
}

// /**
//  * Derive a 32-byte AES-256 key from a password string (SHA-256).
//  * Same derivation as NTI library so the same key string works in both Node and browser.
//  * @param {string} keyString
//  * @returns {Promise<ArrayBuffer>}
//  */
// async function deriveKeyFromPasswordAsync(keyString) {
//   const encoder = new TextEncoder();
//   const data = encoder.encode(keyString);
//   return crypto.subtle.digest("SHA-256", data);
// }

// /**
//  * Encrypt a string using AES-256-CBC (Web Crypto).
//  * Key is derived via SHA-256(keyString). Output is base64(iv || ciphertext).
//  * Compatible with NTI library decryptStringWithKey (same format).
//  * @param {string} plaintext
//  * @param {string} keyString
//  * @returns {Promise<string>} Base64-encoded iv + ciphertext
//  */
// export async function encryptStringAsync(plaintext, keyString) {
//   const keyBytes = await deriveKeyFromPasswordAsync(keyString);
//   const key = await crypto.subtle.importKey(
//     "raw",
//     keyBytes,
//     { name: "AES-CBC" },
//     false,
//     ["encrypt"]
//   );
//   const iv = crypto.getRandomValues(new Uint8Array(16));
//   const encoder = new TextEncoder();
//   const data = encoder.encode(plaintext);
//   const ciphertext = await crypto.subtle.encrypt(
//     { name: "AES-CBC", iv },
//     key,
//     data
//   );
//   const combined = new Uint8Array(iv.length + ciphertext.byteLength);
//   combined.set(iv, 0);
//   combined.set(new Uint8Array(ciphertext), iv.length);
//   let binary = "";
//   for (let i = 0; i < combined.length; i++)
//     binary += String.fromCharCode(combined[i]);
//   return btoa(binary);
// }

// /**
//  * Decrypt a string encrypted with encryptStringAsync (or NTI encryptStringWithKey).
//  * @param {string} ciphertextBase64
//  * @param {string} keyString
//  * @returns {Promise<string>}
//  */
// export async function decryptStringAsync(ciphertextBase64, keyString) {
//   const keyBytes = await deriveKeyFromPasswordAsync(keyString);
//   const key = await crypto.subtle.importKey(
//     "raw",
//     keyBytes,
//     { name: "AES-CBC" },
//     false,
//     ["decrypt"]
//   );
//   const binary = atob(ciphertextBase64);
//   const combined = new Uint8Array(binary.length);
//   for (let i = 0; i < binary.length; i++) combined[i] = binary.charCodeAt(i);
//   const iv = combined.subarray(0, 16);
//   const ciphertext = combined.subarray(16);
//   const decrypted = await crypto.subtle.decrypt(
//     { name: "AES-CBC", iv },
//     key,
//     ciphertext
//   );
//   return new TextDecoder().decode(decrypted);
// }

// /**
//  * Encrypt a metadata object (JSON stringify then encrypt).
//  * @param {object} metadata - BioDesign metadata object
//  * @param {string} keyString
//  * @returns {Promise<string>} Base64-encoded encrypted JSON
//  */
// export async function encryptMetadataAsync(metadata, keyString) {
//   const json = JSON.stringify(metadata, null, 4);
//   return encryptStringAsync(json, keyString);
// }

// /**
//  * Decrypt encrypted metadata (decrypt then JSON parse).
//  * @param {string} encryptedBase64
//  * @param {string} keyString
//  * @returns {Promise<object>} BioDesign metadata object
//  */
// export async function decryptMetadataAsync(encryptedBase64, keyString) {
//   const json = await decryptStringAsync(encryptedBase64, keyString);
//   return JSON.parse(json);
// }
