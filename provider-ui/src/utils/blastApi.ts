/**
 * API utilities for BLAST search functionality
 */

import axios from 'axios';

const BLAST_API_URL = 'http://localhost:8000/blast';

export interface BlastHit {
  title: string;
  accession: string;
  length: number;
  evalue: number;
  bit_score: number;
  identity: number;
  align_length: number;
  query_start: number;
  query_end: number;
  subject_start: number;
  subject_end: number;
  query_seq: string;
  match_seq: string;
  subject_seq: string;
}

export interface BlastResponse {
  error: boolean;
  message?: string;
  hits?: BlastHit[];
  queryLength?: number;
  program?: string;
  database?: string;
}

/**
 * Perform a BLAST search against a local database
 * 
 * @param sequence - The query sequence (DNA or protein)
 * @param sequenceType - 'dna' or 'protein'
 * @param database - Optional database name (defaults to 'nt' for DNA, 'nr' for protein)
 * @param maxHits - Maximum number of hits to return (default: 5)
 * @param evalue - E-value threshold (default: 10.0)
 * @returns BLAST search results
 */
export async function performBlastSearch(
  sequence: string,
  sequenceType: 'dna' | 'protein',
  database?: string,
  maxHits: number = 5,
  evalue: number = 10.0
): Promise<BlastResponse> {
  try {
    const response = await axios.post<BlastResponse>(BLAST_API_URL, {
      sequence,
      sequenceType,
      database,
      maxHits,
      evalue,
    });

    return response.data;
  } catch (error: any) {
    console.error('BLAST search error:', error);
    return {
      error: true,
      message: error.response?.data?.message || error.message || 'Failed to perform BLAST search',
    };
  }
}

/**
 * Format BLAST results as a readable comment string
 * 
 * @param response - BLAST response from the API
 * @returns Formatted string for display as a comment
 */
export function formatBlastResults(response: BlastResponse): string {
  if (response.error) {
    return `BLAST Search Error: ${response.message || 'Unknown error'}`;
  }

  if (!response.hits || response.hits.length === 0) {
    return `BLAST Search: No significant hits found (Program: ${response.program || 'N/A'}, Database: ${response.database || 'N/A'})`;
  }

  const lines: string[] = [];
  lines.push(`BLAST Search Results (${response.program || 'N/A'} vs ${response.database || 'N/A'})`);
  lines.push(`Query length: ${response.queryLength || 'N/A'}`);
  lines.push(`Found ${response.hits.length} hit(s):\n`);

  response.hits.forEach((hit, index) => {
    lines.push(`Hit ${index + 1}:`);
    lines.push(`  Title: ${hit.title}`);
    lines.push(`  Accession: ${hit.accession}`);
    lines.push(`  E-value: ${hit.evalue.toExponential(2)}`);
    lines.push(`  Bit Score: ${hit.bit_score.toFixed(1)}`);
    lines.push(`  Identity: ${hit.identity}/${hit.align_length} (${((hit.identity / hit.align_length) * 100).toFixed(1)}%)`);
    lines.push(`  Alignment: ${hit.query_start}-${hit.query_end} (query) vs ${hit.subject_start}-${hit.subject_end} (subject)`);
    lines.push('');
  });

  return lines.join('\n');
}
