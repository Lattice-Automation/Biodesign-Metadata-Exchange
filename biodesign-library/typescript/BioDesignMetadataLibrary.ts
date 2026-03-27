/**
 * Core BMDE library - metadata creation, encryption, checksum, and revision computation.
 */

import * as crypto from 'crypto';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { diff_match_patch } from 'diff-match-patch';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

export interface BioDesignOperation {
  operationCode: string;
  operationDetails: Record<string, any>;
  change: string;
  timestamp: string;
  tool: string;
  comments: Array<Record<string, string>>;
  status: string;
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

function nowTimestamp(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const y = d.getFullYear();
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${m}/${day}/${y}, ${h}:${min}:${s}`;
}

export class BioDesignMetadataLibrary {
  createMetadata(
    parentMetadataId: string | null,
    designName: string,
    author: string,
    description: string,
    design: string
  ): BioDesignMetadata {
    const metadata: BioDesignMetadata = {
      id: crypto.randomUUID(),
      parentMetadataId: parentMetadataId ?? '',
      designName,
      designChecksum: this.calculateChecksum(design),
      author,
      description,
      lastUpdated: nowTimestamp(),
      changelog: [],
    };
    fs.writeFileSync(
      `library/metadata_${designName}.json`,
      JSON.stringify(metadata, null, 4),
      'utf-8'
    );
    return metadata;
  }

  updateMetadataWithOperation(
    metadataPath: string,
    design: string,
    operationCode: string,
    operationDetails: Record<string, any>,
    change: string,
    comments: Array<Record<string, string>> = [],
    status = ''
  ): BioDesignMetadata {
    const metadataJson = JSON.parse(fs.readFileSync(metadataPath, 'utf-8')) as BioDesignMetadata;
    if (metadataJson.changelog) {
      metadataJson.changelog.forEach((op: Partial<BioDesignOperation>) => {
        if (!op.comments) op.comments = [];
        if (typeof op.status !== 'string') op.status = '';
      });
    }
    const metadata: BioDesignMetadata = metadataJson;
    metadata.lastUpdated = nowTimestamp();
    metadata.designChecksum = this.calculateChecksum(design);
    metadata.changelog.push({
      operationCode,
      operationDetails,
      change,
      timestamp: metadata.lastUpdated,
      tool: 'BioDesign tool',
      comments,
      status: status || '',
    });
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 4), 'utf-8');
    return metadata;
  }

  calculateChecksum(inputStr: string): string {
    return calculateChecksum(inputStr);
  }

  computeDifference(originalString: string, newString: string): string {
    return computeDifference(originalString, newString);
  }

  computeRevisions(lastDesign: string, changelog: Array<Record<string, any>>): Array<Record<string, any>> {
    return computeRevisions(lastDesign, changelog);
  }

  decryptString(encryptedBase64String: string): string {
    return decryptString(encryptedBase64String);
  }

  encryptString(stringToEncrypt: string): string {
    return encryptString(stringToEncrypt);
  }
}

export function calculateChecksum(inputStr: string): string {
  const hash = crypto.createHash('sha256');
  hash.update((inputStr || '').toLowerCase(), 'utf-8');
  return hash.digest('hex');
}

export function computeDifference(originalString: string, newString: string): string {
  const dmp = new diff_match_patch();
  const patches = dmp.patch_make(newString, originalString);
  return dmp.patch_toText(patches);
}

export function computeRevisions(lastDesign: string, changelog: Array<Record<string, any>>): Array<Record<string, any>> {
  const dmp = new diff_match_patch();
  let currentRevision = changelog.length;
  const revisions: Array<Record<string, any>> = [];
  const reversed = [...changelog].reverse();
  let currentDesign = lastDesign;

  for (const operation of reversed) {
    if (!('comments' in operation)) operation.comments = [];
    if (!('status' in operation)) operation.status = '';

    revisions.push({
      revision: currentRevision,
      design: currentDesign,
      operationCode: operation.operationCode,
      operationDetails: operation.operationDetails,
      change: operation.change,
      timestamp: operation.timestamp,
      tool: operation.tool,
      comments: operation.comments,
      status: operation.status,
    });

    if (operation.change) {
      const patches = dmp.patch_fromText(operation.change);
      const [patched] = dmp.patch_apply(patches, currentDesign);
      currentDesign = patched;
    }
    currentRevision -= 1;
  }
  return revisions;
}

export function decryptString(encryptedBase64String: string): string {
  const encryptionKey = process.env.BMDE_ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error(
      'BMDE_ENCRYPTION_KEY environment variable is not set. Please set it to decrypt metadata files.'
    );
  }
  try {
    const key = Buffer.from(encryptionKey, 'utf-8');
    const encryptedDataWithIv = Buffer.from(encryptedBase64String, 'base64');
    const iv = encryptedDataWithIv.subarray(0, 16);
    const encryptedData = encryptedDataWithIv.subarray(16);
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    return decrypted.toString('utf-8');
  } catch (e: any) {
    throw new Error(
      `Failed to decrypt metadata. The encryption key may be incorrect or the data may be corrupted. ${e?.message || e}`
    );
  }
}

export function encryptString(stringToEncrypt: string): string {
  const encryptionKey = process.env.BMDE_ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('BMDE_ENCRYPTION_KEY environment variable is not set.');
  }
  const key = Buffer.from(encryptionKey, 'utf-8');
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(stringToEncrypt, 'utf-8'), cipher.final()]);
  return Buffer.concat([iv, encrypted]).toString('base64');
}
