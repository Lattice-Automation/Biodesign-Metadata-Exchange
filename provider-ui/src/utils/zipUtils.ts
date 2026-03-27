/**
 * Utility functions for working with zip files
 */

import JSZip from 'jszip';
import { acceptsExtension } from './designUtils';
import { METADATA_EXTENSIONS } from './constants';
import { FilePair } from './fileStore';
import { parseResultsFile, isResultsFile, type EvaluationResult } from './resultsUtils';

/** Returns true if any metadata file is encrypted (.txt). JSON metadata is unencrypted. */
export const hasEncryptedMetadata = (files: File[]): boolean =>
  files.some((f) => f.name.toLowerCase().endsWith('.txt'));

/** Returns true if the zip contains any encrypted (.txt) metadata files */
export const zipContainsEncryptedMetadata = async (zipFile: File): Promise<boolean> => {
  const zip = new JSZip();
  const zipData = await zip.loadAsync(zipFile);
  for (const filename of Object.keys(zipData.files)) {
    if (zipData.files[filename].dir) continue;
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'txt') return true;
  }
  return false;
};

export interface ExtractedFiles {
  designFile: File | null;
  metadataFile: File | null;
}

/**
 * Extract design name from design filename
 * Examples:
 * - "sequence-obfuscation_1.gb" -> "sequence-obfuscation_1"
 * - "synpuc19v.gbk" -> "synpuc19v"
 */
export const extractDesignNameFromDesign = (designFilename: string): string => {
  // Remove extension
  return designFilename.replace(/\.(gb|gbk|pdb|fasta|fa|faa|fna)$/i, '');
};

/**
 * Match design files to metadata files based on designName field in metadata JSON
 * This requires decrypting and parsing metadata files, so it's async
 * Returns an array of FilePair objects for matched pairs
 */
export const matchDesignToMetadataFiles = async (
  designFiles: File[],
  metadataFiles: File[],
  encryptionKey: string
): Promise<FilePair[]> => {
  const pairs: FilePair[] = [];

  // Create a map of design files by their filename (without extension)
  const designMap = new Map<string, File>();
  designFiles.forEach(file => {
    const designName = extractDesignNameFromDesign(file.name);
    designMap.set(designName.toLowerCase(), file);
  });

  // Import ProviderTool for parsing metadata
  const { LatticeSynthesisProviderTool } = await import('../ProviderTool');
  const providerTool = new LatticeSynthesisProviderTool(encryptionKey);

  // For each metadata file, extract designName and match to design file
  for (const metadataFile of metadataFiles) {
    try {
      const metadataContent = await metadataFile.text();

      // Parse metadata (handles both encrypted and unencrypted)
      const metadata = await providerTool.parseMetadata(metadataContent);

      const designName = metadata.designName;
      if (!designName) {
        console.warn(`Metadata file ${metadataFile.name} has no designName field`);
        continue;
      }

      // Find matching design file
      const designFile = designMap.get(designName.toLowerCase());
      if (designFile) {
        pairs.push({
          designFile,
          metadataFile,
          designName,
        });
      } else {
        console.warn(`No design file found matching designName "${designName}" from metadata file ${metadataFile.name}`);
      }
    } catch (error) {
      console.error(`Error processing metadata file ${metadataFile.name}:`, error);
      // Continue with other files
    }
  }

  return pairs;
};

/**
 * Extracts design and metadata files from a zip file
 * @param zipFile The zip file to extract from
 * @param encryptionKey The encryption key for decrypting metadata files
 * @returns An object containing the extracted design and metadata files, or null if extraction fails
 * @deprecated Use extractFilePairsFromZip instead for multi-file support
 */
export const extractFilesFromZip = async (zipFile: File, encryptionKey: string): Promise<ExtractedFiles> => {
  try {
    const pairs = await extractFilePairsFromZip(zipFile, encryptionKey);
    if (pairs.length === 0) {
      return { designFile: null, metadataFile: null };
    }
    // For backward compatibility, return the first pair
    return {
      designFile: pairs[0].designFile,
      metadataFile: pairs[0].metadataFile,
    };
  } catch (error) {
    console.error('Error extracting files from zip:', error);
    throw new Error('Failed to extract files from zip. Please ensure the zip contains a design file (.gb, .gbk, .pdb, or .fasta) and a metadata file (.txt or .json).');
  }
};

/**
 * Extracts results.json from a zip file if present (takes precedence)
 * @param zipFile The zip file to extract from
 * @returns EvaluationResult if results.json found, null otherwise
 */
export const extractResultsFromZip = async (zipFile: File): Promise<EvaluationResult | null> => {
  try {
    const zip = new JSZip();
    const zipData = await zip.loadAsync(zipFile);
    for (const [filename, file] of Object.entries(zipData.files)) {
      if (file.dir) continue;
      const name = filename.split('/').pop()?.toLowerCase() ?? '';
      if (name === 'results.json') {
        const content = await file.async('string');
        const blob = new Blob([content], { type: 'application/json' });
        const extractedFile = new File([blob], 'results.json', { type: 'application/json' });
        return parseResultsFile(extractedFile);
      }
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Extracts all design and metadata file pairs from a zip file
 * @param zipFile The zip file to extract from
 * @param encryptionKey The encryption key for decrypting metadata files
 * @returns An array of FilePair objects for matched design/metadata pairs
 */
export const extractFilePairsFromZip = async (zipFile: File, encryptionKey?: string): Promise<FilePair[]> => {
  try {
    const zip = new JSZip();
    const zipData = await zip.loadAsync(zipFile);

    const designFiles: File[] = [];
    const metadataFiles: File[] = [];

    // Iterate through all files in the zip
    for (const [filename, file] of Object.entries(zipData.files)) {
      if (file.dir) {
        continue; // Skip directories
      }

      const extension = filename.split('.').pop()?.toLowerCase() ?? '';

      // Check if this is a valid file type
      if (!acceptsExtension(extension)) {
        continue; // Skip unsupported file types
      }

      // Read file content
      const content = await file.async('string');

      // Create File object
      const extractedFile = new File([content], filename, { type: 'text/plain' });

      // Categorize file
      if (METADATA_EXTENSIONS.includes(extension as 'txt' | 'json')) {
        metadataFiles.push(extractedFile);
      } else {
        // Design file (.gb, .gbk, or .pdb)
        designFiles.push(extractedFile);
      }
    }

    // Match design files to metadata files based on designName in metadata
    const pairs = await matchDesignToMetadataFiles(designFiles, metadataFiles, encryptionKey ?? '');

    return pairs;
  } catch (error) {
    console.error('Error extracting file pairs from zip:', error);
    throw new Error('Failed to extract files from zip. Please ensure the zip contains matching design files (.gb, .gbk, .pdb, or .fasta) and metadata files (.txt or .json).');
  }
};

/**
 * Checks if a file is a zip file based on its name or type
 */
export const isZipFile = (file: File): boolean => {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return extension === 'zip' || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
};

