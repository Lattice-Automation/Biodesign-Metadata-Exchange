/**
 * Utility functions for working with sample files
 */

import JSZip from 'jszip';

export interface SampleFilePair {
  id: string;
  name: string;
  description: string;
  zipFile: string; // Path to zip file containing design and metadata files
}

let samplesCache: SampleFilePair[] | null = null;

/**
 * Loads the list of available sample file pairs from the samples.json config
 */
export const loadSamples = async (): Promise<SampleFilePair[]> => {
  if (samplesCache) {
    return samplesCache;
  }

  try {
    const response = await fetch('/samples/samples.json');
    if (!response.ok) {
      throw new Error('Failed to load samples configuration');
    }
    const samples = await response.json() as SampleFilePair[];
    samplesCache = samples;
    return samples;
  } catch (error) {
    console.error('Error loading samples:', error);
    return [];
  }
};

/**
 * Downloads a sample zip file to the user's computer
 */
export const downloadSampleFiles = async (sample: SampleFilePair): Promise<void> => {
  try {
    // Download the zip file directly
    const zipResponse = await fetch(`/samples/${sample.zipFile}`);
    if (!zipResponse.ok) {
      throw new Error(`Failed to download zip file: ${sample.zipFile}`);
    }
    const zipBlob = await zipResponse.blob();

    // Download the zip file
    const zipUrl = URL.createObjectURL(zipBlob);
    const zipLink = document.createElement('a');
    zipLink.href = zipUrl;
    zipLink.download = `${sample.id}.zip`;
    document.body.appendChild(zipLink);
    zipLink.click();
    document.body.removeChild(zipLink);
    URL.revokeObjectURL(zipUrl);
  } catch (error) {
    console.error('Error downloading sample files:', error);
    throw error;
  }
};

/**
 * Loads a sample zip file and extracts file pairs for use in the application
 * Returns an array of FilePair objects (supports multi-file samples)
 */
export const loadSampleFiles = async (sample: SampleFilePair): Promise<import('./fileStore').FilePair[]> => {
  try {
    // Fetch the zip file
    const zipResponse = await fetch(`/samples/${sample.zipFile}`);
    if (!zipResponse.ok) {
      throw new Error(`Failed to load zip file: ${sample.zipFile}`);
    }
    const zipBlob = await zipResponse.blob();
    const zipFile = new File([zipBlob], `${sample.id}.zip`, { type: 'application/zip' });

    // Extract file pairs from the zip - only need encryption key for .txt (encrypted) metadata
    const { extractFilePairsFromZip, zipContainsEncryptedMetadata } = await import('./zipUtils');
    const needsKey = await zipContainsEncryptedMetadata(zipFile);
    const encryptionKey = needsKey ? (await import('./settings')).getEncryptionKey() : undefined;
    if (needsKey && !encryptionKey) {
      throw new Error('Encryption key is required for encrypted (.txt) metadata files');
    }

    const filePairs = await extractFilePairsFromZip(zipFile, encryptionKey);
    return filePairs;
  } catch (error) {
    console.error('Error loading sample files:', error);
    throw error;
  }
};

