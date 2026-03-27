/**
 * Browser-compatible Lattice Synthesis Provider Tool
 * 
 * This module provides functionality for validating and processing biological designs
 * and their associated metadata entirely in the browser. It supports both sequence 
 * (GenBank) and structure (PDB) file formats.
 * 
 * Key Features:
 * - Design and metadata validation
 * - Checksum verification
 * - Revision history computation
 * - Support for multiple file formats (GenBank, PDB)
 */

import { parseFile } from 'seqparse';
import { diff_match_patch } from 'diff-match-patch';

export interface Comment {
  timestamp: string;
  text: string;
}

export interface BioDesignOperation {
  operationCode: string;
  operationDetails: Record<string, any>;
  change: string;
  timestamp: string;
  tool: string;
  comments?: Comment[];
  status?: string;
}

export interface BioDesignMetadata {
  id: string;
  parentMetadataId: string | null;
  designName: string | null;
  designChecksum: string;
  author: string;
  description: string;
  lastUpdated: string;
  changelog: BioDesignOperation[];
}

export interface ComputeRevisionsResponse {
  error?: boolean;
  message?: string;
  id: string;
  parentMetadataId: string;
  designName: string;
  author: string;
  description: string;
  lastUpdated: string;
  revisions: Revision[];
}

export interface Revision extends BioDesignOperation {
  revision: number;
  design: string;
}

/**
 * Calculate SHA-256 checksum of a string (browser-compatible).
 * 
 * @param input - String to calculate checksum for
 * @returns Hexadecimal representation of the SHA-256 hash
 */
export async function calculateChecksum(input: string): Promise<string> {
  // Make it case-insensitive
  const normalized = input.toLowerCase();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Custom error class for decryption failures
 */
export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecryptionError';
  }
}

/**
 * Encrypt a string using AES-CBC (browser-compatible).
 * 
 * @param plaintext - String to encrypt
 * @param encryptionKey - Encryption key (32 bytes for AES-256)
 * @returns Base64-encoded encrypted string with IV prepended
 */
async function encryptString(plaintext: string, encryptionKey: string): Promise<string> {
  try {
    // Convert encryption key to ArrayBuffer
    const keyData = new TextEncoder().encode(encryptionKey);
    const keyBuffer = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-CBC' },
      false,
      ['encrypt']
    );

    // Generate a random IV (16 bytes for AES-CBC)
    const iv = crypto.getRandomValues(new Uint8Array(16));

    // Convert plaintext to ArrayBuffer
    const plaintextData = new TextEncoder().encode(plaintext);

    // Encrypt the data
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-CBC',
        iv: iv,
      },
      keyBuffer,
      plaintextData
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedBuffer), iv.length);

    // Convert to base64
    // Convert Uint8Array to array first to avoid TypeScript iteration issues
    const combinedArray = Array.from(combined);
    const base64String = btoa(String.fromCharCode(...combinedArray));
    return base64String;
  } catch (error: any) {
    throw new Error(`Failed to encrypt metadata: ${error.message}`);
  }
}

/**
 * Decrypt an encrypted string using AES-CBC (browser-compatible).
 * 
 * @param encryptedBase64String - Base64-encoded encrypted string
 * @param encryptionKey - Encryption key (32 bytes for AES-256)
 * @returns Decrypted string
 * @throws DecryptionError if decryption fails (e.g., wrong key)
 */
export async function decryptString(encryptedBase64String: string, encryptionKey: string): Promise<string> {
  try {
    // Convert encryption key to ArrayBuffer
    const keyData = new TextEncoder().encode(encryptionKey);
    const keyBuffer = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-CBC' },
      false,
      ['decrypt']
    );

    // Decode the base64 string
    const encryptedDataWithIv = Uint8Array.from(atob(encryptedBase64String), c => c.charCodeAt(0));

    // Extract the first 16 bytes for the IV
    const iv = encryptedDataWithIv.slice(0, 16);

    // Extract the rest of the bytes for the encrypted message
    const encryptedData = encryptedDataWithIv.slice(16);

    // Decrypt the data
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-CBC',
        iv: iv,
      },
      keyBuffer,
      encryptedData
    );

    // Convert to string and remove padding (PKCS7 padding is automatically handled by Web Crypto API)
    return new TextDecoder().decode(decryptedBuffer);
  } catch (error: any) {
    // Check if it's a decryption error (wrong key, corrupted data, etc.)
    if (error instanceof DOMException || error.name === 'OperationError' || error.message?.includes('decrypt')) {
      throw new DecryptionError('Failed to decrypt metadata. The encryption key may be incorrect.');
    }
    throw error;
  }
}

/**
 * Compute all revisions of a design from its changelog.
 * 
 * @param lastDesign - Most recent version of the design
 * @param changelog - List of operations performed
 * @returns List of revisions with their associated operations
 */
function computeRevisions(lastDesign: string, changelog: BioDesignOperation[]): Revision[] {
  const dmp = new diff_match_patch();
  const currentRevision = changelog.length;
  const revisions: Revision[] = [];

  // Reverse changelog so we apply the last modification first
  const reversedChangelog = [...changelog].reverse();

  let currentDesign = lastDesign;

  for (let i = 0; i < reversedChangelog.length; i++) {
    const operation = reversedChangelog[i];
    const revisionNumber = currentRevision - i;

    revisions.push({
      revision: revisionNumber,
      design: currentDesign,
      operationCode: operation.operationCode,
      operationDetails: operation.operationDetails,
      change: operation.change,
      timestamp: operation.timestamp,
      tool: operation.tool,
      comments: operation.comments ?? [],
      status: operation.status ?? "",
    });

    // Apply the change in reverse to get the previous version
    if (operation.change) {
      const patches = dmp.patch_fromText(operation.change);
      const [patchedDesign, results] = dmp.patch_apply(patches, currentDesign);
      // Only use if all patches applied successfully
      if (results.every((r: boolean) => r === true)) {
        currentDesign = patchedDesign;
      } else {
        console.warn(`Failed to apply patches for operation ${operation.operationCode} at revision ${revisionNumber}. Results:`, results);
      }
    }
  }

  return revisions;
}

/**
 * Extract sequence from GenBank file content.
 * 
 * @param genbankContent - GenBank file content as string
 * @returns The DNA sequence string
 */
export async function extractSequenceFromGenBank(genbankContent: string): Promise<string> {
  try {
    const parsed = await parseFile(genbankContent);
    if (parsed && parsed.length > 0) {
      return parsed[0].seq;
    }
    throw new Error('No sequence found in GenBank file');
  } catch (error) {
    throw new Error(`Failed to parse GenBank file: ${error}`);
  }
}

/**
 * Extract sequence from FASTA file content.
 * 
 * @param fastaContent - FASTA file content as string
 * @returns The sequence string (lowercase)
 */
export function extractSequenceFromFASTA(fastaContent: string): string {
  const lines = fastaContent.trim().split(/\r?\n/);
  const seqParts: string[] = [];
  for (const line of lines) {
    if (!line.startsWith('>')) {
      seqParts.push(line.replace(/\s/g, ''));
    }
  }
  const seq = seqParts.join('');
  if (!seq) throw new Error('No sequence found in FASTA file');
  return seq.toLowerCase();
}

/**
 * Convert FASTA content to minimal GenBank format for revision computation.
 * Changelog patches expect GenBank format.
 */
function fastaToGenBank(fastaContent: string): string {
  const lines = fastaContent.trim().split(/\r?\n/);
  let id = 'sequence';
  const seqParts: string[] = [];
  for (const line of lines) {
    if (line.startsWith('>')) {
      const rest = line.slice(1).trim();
      const firstSpace = rest.indexOf(' ');
      id = firstSpace >= 0 ? rest.slice(0, firstSpace) : (rest || id);
    } else {
      seqParts.push(line.replace(/\s/g, ''));
    }
  }
  const seq = seqParts.join('').toLowerCase();
  const len = seq.length;
  // Format ORIGIN block: 6 blocks of 10 per line (60 chars), position left-padded
  const chunks: string[] = [];
  for (let i = 0; i < seq.length; i += 60) {
    const chunk = seq.slice(i, i + 60);
    const padded = chunk.match(/.{1,10}/g)?.join(' ') ?? chunk;
    const pos = (i + 1).toString().padStart(9);
    chunks.push(`${pos} ${padded}`);
  }
  const originBlock = chunks.join('\n');
  return `LOCUS       ${(id || 'sequence').slice(0, 16).padEnd(16)} ${len} bp    dna     linear\nDEFINITION  .\nACCESSION   \nVERSION     \nORIGIN\n${originBlock}\n//`;
}

/**
 * Convert GenBank record to GenBank format string.
 * For now, we'll just return the original content since we're working with strings.
 * 
 * @param genbankContent - GenBank file content
 * @returns GenBank format string
 */
function getStringFromGenBank(genbankContent: string): string {
  return genbankContent;
}

function isFASTAFile(fileName: string | undefined): boolean {
  if (!fileName) return false;
  const lower = fileName.toLowerCase();
  return lower.endsWith('.fasta') || lower.endsWith('.fa') || lower.endsWith('.faa') || lower.endsWith('.fna');
}

function isFASTAContent(content: string): boolean {
  return content.trim().startsWith('>');
}

export class LatticeSynthesisProviderTool {
  private encryptionKey: string;

  /**
   * Initialize the Lattice Synthesis Provider Tool.
   * 
   * @param encryptionKey - Encryption key for decrypting metadata (32 bytes for AES-256)
   */
  constructor(encryptionKey?: string) {
    // Get encryption key from environment variable or use provided key
    // In browser, we'll need to get this from a config or environment
    this.encryptionKey = encryptionKey || process.env.REACT_APP_BMDE_ENCRYPTION_KEY || '';

    if (!this.encryptionKey) {
      console.warn('Encryption key not provided. Metadata decryption will fail.');
    }
  }

  /**
   * Parse metadata file content (plain JSON or encrypted). Try JSON first for .json / unencrypted.
   */
  private async parseMetadataContent(metadataFileContent: string): Promise<BioDesignMetadata> {
    const trimmed = metadataFileContent.trim();
    if (trimmed.startsWith('{')) {
      try {
        return JSON.parse(metadataFileContent) as BioDesignMetadata;
      } catch {
        // Not valid JSON, fall through to decrypt
      }
    }
    const decrypted = await decryptString(metadataFileContent, this.encryptionKey);
    return JSON.parse(decrypted) as BioDesignMetadata;
  }

  /**
   * Verify that a design file matches its associated metadata.
   * 
   * @param designFileContent - Content of the design file (GenBank or PDB)
   * @param metadataFileContent - Content of the metadata file (plain JSON or encrypted .txt)
   * @param designFileName - Optional filename to help determine file type
   * @returns Object with `matches` boolean and optional `error` string for decryption failures
   */
  async designAndMetadataMatch(
    designFileContent: string,
    metadataFileContent: string,
    designFileName?: string
  ): Promise<{ matches: boolean; error?: string }> {
    try {
      const metadata = await this.parseMetadataContent(metadataFileContent);

      const designChecksumInMetadata = metadata.designChecksum;

      // Calculate checksum of the design file
      let receivedDesignChecksum: string;

      // Check file type - use filename if available, otherwise check content
      const isPDBFile = designFileName
        ? designFileName.toLowerCase().endsWith('.pdb')
        : designFileContent.trim().match(/^(HEADER|ATOM|REMARK|TITLE|COMPND|SOURCE|AUTHOR|CRYST1|MODEL|ENDMDL)/m) !== null;
      const isFASTA = designFileName ? isFASTAFile(designFileName) : isFASTAContent(designFileContent);

      if (isPDBFile) {
        receivedDesignChecksum = await calculateChecksum(designFileContent);
      } else if (isFASTA) {
        const sequence = extractSequenceFromFASTA(designFileContent);
        receivedDesignChecksum = await calculateChecksum(sequence);
      } else {
        const sequence = await extractSequenceFromGenBank(designFileContent);
        receivedDesignChecksum = await calculateChecksum(sequence);
      }

      return { matches: designChecksumInMetadata === receivedDesignChecksum };
    } catch (error: any) {
      console.error('Error in designAndMetadataMatch:', error);
      // Check if it's a decryption error
      if (error instanceof DecryptionError || error.name === 'DecryptionError') {
        return { matches: false, error: 'DECRYPTION_ERROR' };
      }
      return { matches: false };
    }
  }

  /**
   * Compute the revision history of a design.
   * 
   * @param designFileContent - Content of the design file (GenBank or PDB)
   * @param metadataFileContent - Content of the metadata file (plain JSON or encrypted .txt)
   * @param designFileName - Optional filename to help determine file type
   * @returns Object containing design metadata and revision history
   */
  async computeRevisions(
    designFileContent: string,
    metadataFileContent: string,
    designFileName?: string
  ): Promise<ComputeRevisionsResponse> {
    try {
      const metadata = await this.parseMetadataContent(metadataFileContent);

      // Get the last design version
      let lastDesign: string;

      // Check file type - use filename if available, otherwise check content
      const isPDBFile = designFileName
        ? designFileName.toLowerCase().endsWith('.pdb')
        : designFileContent.trim().match(/^(HEADER|ATOM|REMARK|TITLE|COMPND|SOURCE|AUTHOR|CRYST1|MODEL|ENDMDL)/m) !== null;
      const isFASTA = designFileName ? isFASTAFile(designFileName) : isFASTAContent(designFileContent);

      if (isPDBFile) {
        lastDesign = designFileContent;
      } else if (isFASTA) {
        lastDesign = fastaToGenBank(designFileContent);
      } else {
        lastDesign = getStringFromGenBank(designFileContent);
      }

      // Compute revisions from changelog
      console.log(`Computing revisions for ${metadata.designName}: changelog has ${metadata.changelog.length} operations`);
      let revisions = computeRevisions(lastDesign, metadata.changelog);
      
      // Apply auto-highlighting rules if available
      try {
        // Dynamic import to avoid circular dependencies
        const ruleChecker = await import('./utils/ruleChecker');
        const result = ruleChecker.applyRulesToRevisions(revisions);
        revisions = result.revisions;
      } catch (error) {
        // If rule checker is not available, continue without applying rules
        console.warn('Could not apply auto-highlighting rules:', error);
      }
      
      console.log(`Computed ${revisions.length} revisions for ${metadata.designName}`);

      return {
        id: metadata.id,
        parentMetadataId: metadata.parentMetadataId || '',
        designName: metadata.designName || '',
        author: metadata.author,
        description: metadata.description,
        lastUpdated: metadata.lastUpdated,
        revisions: revisions,
      };
    } catch (error: any) {
      // Check if it's a decryption error
      if (error instanceof DecryptionError || error.name === 'DecryptionError') {
        return {
          error: true,
          message: 'DECRYPTION_ERROR',
          id: '',
          parentMetadataId: '',
          designName: '',
          author: '',
          description: '',
          lastUpdated: '',
          revisions: [],
        };
      }
      return {
        error: true,
        message: `Failed to compute revisions: ${error}`,
        id: '',
        parentMetadataId: '',
        designName: '',
        author: '',
        description: '',
        lastUpdated: '',
        revisions: [],
      };
    }
  }

  /**
   * Encrypt metadata JSON string.
   * 
   * @param metadataJson - JSON string of metadata to encrypt
   * @returns Base64-encoded encrypted string
   */
  async encryptMetadata(metadataJson: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not provided. Cannot encrypt metadata.');
    }
    return await encryptString(metadataJson, this.encryptionKey);
  }

  /**
   * Decrypt metadata file content.
   * 
   * @param encryptedMetadataContent - Encrypted metadata content (base64-encoded)
   * @returns Decrypted metadata JSON string
   * @throws DecryptionError if decryption fails
   */
  async decryptMetadata(encryptedMetadataContent: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not provided. Cannot decrypt metadata.');
    }
    return await decryptString(encryptedMetadataContent, this.encryptionKey);
  }

  /**
   * Parse metadata file content (handles both encrypted and unencrypted).
   * 
   * @param metadataContent - Metadata file content (may be encrypted or plain JSON)
   * @returns Parsed BioDesignMetadata object
   */
  async parseMetadata(metadataContent: string): Promise<BioDesignMetadata> {
    // Try to parse as JSON first (might be unencrypted)
    try {
      return JSON.parse(metadataContent);
    } catch {
      // If parsing fails, try to decrypt first
      const decrypted = await this.decryptMetadata(metadataContent);
      return JSON.parse(decrypted);
    }
  }
}

