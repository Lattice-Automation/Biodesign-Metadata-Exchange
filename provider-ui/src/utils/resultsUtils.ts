/**
 * Utilities for parsing and converting Python evaluation results (results.json)
 */

import type { UnifiedGraph, ExtendedRevision } from './graphConstruction';
import type { ComputeRevisionsResponse } from '../ProviderTool';

/** Revision from results.json (camelCase from Python output) */
export interface ResultsRevision {
  revision: number;
  design: string;
  operationCode: string;
  operationDetails: Record<string, unknown>;
  change: string;
  timestamp: string;
  tool: string;
  comments: Array<{ timestamp: string; text: string }>;
  status?: string;
  autoScreeningRecommended?: boolean;
  screeningStatus?: string | null;
}

/** Summary from results.json */
export interface ResultsSummary {
  finalRecommendation?: string;
  designName: string;
  author: string;
  totalRevisions: number;
  operationTypes: Record<string, number>;
  flaggedRevisions: number;
  autoScreeningRecommendedCount?: number;
  dateRange?: { earliest: string; latest: string } | null;
  ruleStats?: Record<string, number>;
  appliedRules?: Array<{ name: string; flaggedCount: number; autoScreen?: boolean }>;
  screeningStatusCounts?: Record<string, number>;
}

/** Full evaluation result from results.json */
export interface EvaluationResult {
  success: boolean;
  error?: string | null;
  warnings?: string[];
  id?: string;
  parentMetadataId?: string;
  designName?: string;
  author?: string;
  description?: string;
  lastUpdated?: string;
  revisions: ResultsRevision[];
  summary?: ResultsSummary | null;
}

/** Check if a file looks like a results.json (by name or content) */
export function isResultsFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name === 'results.json' || (name.endsWith('.json') && name.includes('results'));
}

/** Parse results.json file content */
export async function parseResultsFile(file: File): Promise<EvaluationResult> {
  const text = await file.text();
  const data = JSON.parse(text) as EvaluationResult;
  if (!data.revisions || !Array.isArray(data.revisions)) {
    throw new Error('Invalid results file: missing or invalid revisions array');
  }
  return data;
}

/** Convert Python status to display color palette (error=red, warning=yellow, success=green) */
export function getStatusColor(status: string | undefined): 'error' | 'warning' | 'success' | undefined {
  if (!status || status === '' || status === 'default') return undefined;
  if (status === 'screening_failed' || status === 'marked_unsafe') return 'error';
  if (status === 'flagged') return 'warning';
  if (status === 'screening_passed' || status === 'marked_safe') return 'success';
  // Legacy
  if (status === 'red') return 'error';
  if (status === 'yellow') return 'warning';
  if (status === 'green') return 'success';
  return undefined;
}

/** Convert EvaluationResult to UnifiedGraph format */
export function resultsToUnifiedGraph(result: EvaluationResult): UnifiedGraph {
  const metadataId = result.id || result.designName || 'results';
  const designName = result.designName || 'Unknown';

  const extendedRevisions: ExtendedRevision[] = result.revisions.map((r) => ({
    revision: r.revision,
    design: r.design,
    operationCode: r.operationCode,
    operationDetails: r.operationDetails || {},
    change: r.change || '',
    timestamp: r.timestamp,
    tool: r.tool,
    comments: r.comments || [],
    status: r.status ?? '',
    metadataId,
    metadataParentId: result.parentMetadataId || null,
    designName,
    filePairIndex: 0,
  }));

  const metadataMap = new Map();
  metadataMap.set(metadataId, {
    metadata: {
      id: metadataId,
      parentMetadataId: result.parentMetadataId || null,
      designName,
      designChecksum: '',
      author: result.author || '',
      description: result.description || '',
      lastUpdated: result.lastUpdated || '',
      changelog: [],
    },
    revisions: extendedRevisions,
    filePair: null,
  });

  return {
    revisions: extendedRevisions,
    crossReferences: [],
    metadataMap,
  };
}

/** Convert EvaluationResult to ComputeRevisionsResponse for compatibility */
export function resultsToComputeRevisionsResponse(result: EvaluationResult): ComputeRevisionsResponse {
  return {
    id: result.id || result.designName || '',
    parentMetadataId: result.parentMetadataId || '',
    designName: result.designName || '',
    author: result.author || '',
    description: result.description || '',
    lastUpdated: result.lastUpdated || '',
    revisions: result.revisions.map((r) => ({
      revision: r.revision,
      design: r.design,
      operationCode: r.operationCode,
      operationDetails: r.operationDetails || {},
      change: r.change || '',
      timestamp: r.timestamp,
      tool: r.tool,
      comments: r.comments || [],
      status: r.status ?? '',
    })),
  };
}
