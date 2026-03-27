/**
 * Application-wide constants
 */

export const FILE_EXTENSIONS = {
  GENBANK: ['.gb', '.gbk'],
  PDB: ['.pdb'],
  FASTA: ['.fasta', '.fa', '.faa', '.fna'],
  METADATA: ['.txt', '.json'],
  ALL: ['.gb', '.gbk', '.pdb', '.fasta', '.fa', '.faa', '.fna', '.txt', '.json'],
} as const;

export const ACCEPTED_EXTENSIONS = FILE_EXTENSIONS.ALL.join(',');

/** Extensions accepted for metadata files (unencrypted .json or encrypted .txt) */
export const METADATA_EXTENSIONS = ['txt', 'json'] as const;

export const FILE_TYPES = {
  GENBANK: ['gb', 'gbk'],
  PDB: ['pdb'],
  FASTA: ['fasta', 'fa', 'faa', 'fna'],
  METADATA: 'txt', // legacy; use METADATA_EXTENSIONS for "is metadata file" checks
} as const;

export const TOAST_MESSAGES = {
  UNSUPPORTED_FILE_TYPE: (fileName: string) => `Unsupported file type: ${fileName}`,
  ENCRYPTION_KEY_MISSING: 'Encryption key not configured. Please set the key in settings.',
  ENCRYPTION_KEY_INVALID: 'Invalid encryption key. The metadata file could not be decrypted. Please check your key in the settings.',
  DESIGN_METADATA_MISMATCH: 'Design file and metadata file do not match. Please upload matching files.',
  DESIGN_HISTORY_LOADED: 'Design history loaded.',
  UNABLE_TO_READ_GENBANK: 'Unable to read the design file.',
  FAILED_TO_COMPUTE_REVISIONS: 'Failed to compute revisions.',
} as const;

export const UI_LABELS = {
  DESIGN_OVERVIEW: 'Design Overview',
  METADATA_OVERVIEW: 'Metadata Overview',
  VERSION_GRAPH: 'Version Graph',
  VERSION_DETAILS: 'Revision Details',
  READING_FILE: 'Reading file...',
  DECRYPTING_METADATA: 'Loading metadata...',
  WAITING_FOR_GENBANK: 'Waiting for design file to process metadata.',
  BUILDING_GRAPH: 'Building graph...',
  NO_REVISIONS: 'No revisions available.',
  DROP_FILES: 'Drop in a design file (.gb, .gbk, .pdb, .fasta) and metadata file (.txt or .json), or a zip file containing both, to generate the design history graph.',
} as const;

