import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import {
  ComputeRevisionsResponse,
  TOAST_MESSAGES,
  getEncryptionKey,
  buildUnifiedGraph,
  resultsToUnifiedGraph,
  resultsToComputeRevisionsResponse,
  hasEncryptedMetadata,
  type UnifiedGraph,
  type EvaluationResult,
} from '../utils';
import { FilePair } from '../utils/fileStore';

interface UseRevisionsOptions {
  filePairs: FilePair[];
  storedResults?: EvaluationResult | null;
}

export const useRevisions = ({ filePairs, storedResults }: UseRevisionsOptions) => {
  const [unifiedGraph, setUnifiedGraph] = useState<UnifiedGraph | null>(null);
  const [computeRevisionsResponse, setComputeRevisionsResponse] = useState<ComputeRevisionsResponse | null>(null);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const requestIdRef = useRef(0);

  const loadFromResults = useCallback((result: EvaluationResult) => {
    const graph = resultsToUnifiedGraph(result);
    const response = resultsToComputeRevisionsResponse(result);
    setUnifiedGraph(graph);
    setComputeRevisionsResponse(response);
    setEvaluationResult(result);
    toast.success(`Results loaded: ${result.revisions.length} revisions`);
  }, []);

  const loadRevisions = useCallback(async (pairs: FilePair[]) => {
    if (pairs.length === 0) {
      setUnifiedGraph(null);
      setComputeRevisionsResponse(null);
      setEvaluationResult(null);
      setIsFetching(false);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsFetching(true);

    try {
      const needsKey = hasEncryptedMetadata(pairs.map((p) => p.metadataFile));
      const encryptionKey = needsKey ? getEncryptionKey() : undefined;
      if (needsKey && !encryptionKey) {
        toast.error(TOAST_MESSAGES.ENCRYPTION_KEY_MISSING);
        return;
      }

      const graph = await buildUnifiedGraph(pairs, encryptionKey);

      if (requestId !== requestIdRef.current) return;

      if (graph.revisions.length === 0) {
        setUnifiedGraph(null);
        setComputeRevisionsResponse(null);
        setEvaluationResult(null);
        toast.error('No revisions found in the provided files');
        return;
      }

      setUnifiedGraph(graph);
      setEvaluationResult(null);

      const firstMetadataId = graph.revisions[0]?.metadataId;
      if (firstMetadataId) {
        const firstMetadataData = graph.metadataMap.get(firstMetadataId);
        if (firstMetadataData) {
          const firstRevisions = graph.revisions.filter(r => r.metadataId === firstMetadataId);
          setComputeRevisionsResponse({
            id: firstMetadataId,
            parentMetadataId: firstMetadataData.metadata.parentMetadataId || '',
            designName: firstMetadataData.metadata.designName || '',
            author: firstMetadataData.metadata.author,
            description: firstMetadataData.metadata.description,
            lastUpdated: firstMetadataData.metadata.lastUpdated,
            revisions: firstRevisions.map(r => ({
              revision: r.revision,
              operationCode: r.operationCode,
              operationDetails: r.operationDetails,
              change: r.change,
              timestamp: r.timestamp,
              tool: r.tool,
              comments: r.comments || [],
              status: r.status || '',
              design: r.design,
            })),
          });
        }
      }

      toast.success(`Design history loaded: ${graph.revisions.length} revisions from ${pairs.length} file pair(s)`);
    } catch (error: any) {
      if (requestId === requestIdRef.current) {
        setUnifiedGraph(null);
        setComputeRevisionsResponse(null);
        setEvaluationResult(null);
      }
      console.error('Error loading revisions:', error);
      if (error.message?.includes('decrypt') || error.message?.includes('DECRYPTION_ERROR')) {
        toast.error(TOAST_MESSAGES.ENCRYPTION_KEY_INVALID);
      } else {
        toast.error(error.message || TOAST_MESSAGES.FAILED_TO_COMPUTE_REVISIONS);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsFetching(false);
      }
    }
  }, []);

  useEffect(() => {
    if (storedResults && storedResults.revisions?.length) {
      loadFromResults(storedResults);
      return;
    }
    void loadRevisions(filePairs);
  }, [filePairs, storedResults, loadRevisions, loadFromResults]);

  return {
    unifiedGraph,
    computeRevisionsResponse,
    evaluationResult,
    isFetching,
  };
};

