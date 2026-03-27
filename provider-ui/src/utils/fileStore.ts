/**
 * Temporary file store for passing File objects between routes
 * Since File objects aren't serializable, we use this in-memory store
 * to pass them from the Home page to the DesignGraph page
 */

import type { EvaluationResult } from './resultsUtils';

export interface FilePair {
  designFile: File;
  metadataFile: File;
  designName: string; // Extracted from metadata filename
}

let storedFiles: FilePair[] | null = null;
let storedResults: EvaluationResult | null = null;

export const setStoredFiles = (pairs: FilePair[]) => {
  storedFiles = pairs;
  storedResults = null;
};

export const getStoredFiles = (): FilePair[] | null => {
  return storedFiles;
};

export const setStoredResults = (result: EvaluationResult) => {
  storedResults = result;
  storedFiles = null;
};

export const getStoredResults = (): EvaluationResult | null => {
  return storedResults;
};

export const clearStoredFiles = () => {
  storedFiles = null;
  storedResults = null;
};

