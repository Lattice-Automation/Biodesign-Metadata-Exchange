/**
 * Shared types for BioDesign metadata and edit tracking.
 * Consumable by TypeScript projects integrating the standard.
 * @module @teselagen/ove/src/biodesign/types
 */

/** Single changelog row in exported metadata (matches NTI / OVE export shape). */
export interface ChangelogEntry {
  operationCode: string;
  operationDetails: Record<string, unknown>;
  change: string;
  timestamp: string;
  tool: string;
}

/** Top-level BioDesign metadata object (same shape as NTI buildMetadata). */
export interface BioDesignMetadata {
  id: string;
  parentMetadataId: string;
  designName: string;
  designChecksum: string;
  author: string;
  description: string;
  lastUpdated: string;
  changelog: ChangelogEntry[];
}

/**
 * Edit descriptor stored on each undo-stack entry (OVE convention).
 * `type` is UPPER_SNAKE; other fields depend on the operation.
 */
export interface EditDescriptor {
  type: string;
  label?: string;
  [key: string]: unknown;
}

/** Undo stack entry shape OVE uses for persistence (past/future). */
export interface UndoStackEntry {
  sequenceData?: unknown;
  selectionLayer?: unknown;
  caretPosition?: number;
  editDescriptor?: EditDescriptor;
}

/** Result of validation helpers. */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
