/**
 * Graph construction utilities for building unified graphs from multiple metadata files
 */

import { FilePair } from './fileStore';
import { LatticeSynthesisProviderTool, BioDesignMetadata } from '../ProviderTool';

/**
 * Extended revision that includes metadata about which file pair it belongs to
 */
export interface ExtendedRevision {
  revision: number;
  operationCode: string;
  operationDetails: Record<string, any>;
  change: string;
  timestamp: string;
  tool: string;
  comments?: Array<{ timestamp: string; text: string }>;
  status?: string;
  design: string;
  metadataId: string; // ID of the metadata file this revision belongs to
  metadataParentId: string | null; // Parent metadata ID
  designName: string; // Design name from metadata
  filePairIndex: number; // Index in the filePairs array
}

/**
 * Cross-reference between revisions (e.g., PASTE operation referencing COPY operation)
 */
export interface CrossReference {
  fromRevision: ExtendedRevision; // The revision that references
  toRevision: ExtendedRevision; // The revision being referenced
  referenceType: 'copied_from'; // Type of cross-reference
  referenceMetadata: any; // Additional metadata about the reference
}

/**
 * Unified graph structure containing all revisions and their relationships
 */
export interface UnifiedGraph {
  revisions: ExtendedRevision[]; // All revisions from all metadata files
  crossReferences: CrossReference[]; // Cross-references between revisions
  metadataMap: Map<string, {
    metadata: BioDesignMetadata;
    revisions: ExtendedRevision[];
    filePair: FilePair | null;
  }>; // Map of metadata ID to its data
}

/**
 * Builds a unified graph from multiple file pairs
 * 
 * @param filePairs - Array of design/metadata file pairs
 * @param encryptionKey - Encryption key for decrypting metadata
 * @returns Unified graph structure with all revisions and relationships
 */
export async function buildUnifiedGraph(
  filePairs: FilePair[],
  encryptionKey?: string
): Promise<UnifiedGraph> {
  const providerTool = new LatticeSynthesisProviderTool(encryptionKey ?? '');
  const revisions: ExtendedRevision[] = [];
  const crossReferences: CrossReference[] = [];
  const metadataMap = new Map<string, {
    metadata: BioDesignMetadata;
    revisions: ExtendedRevision[];
    filePair: FilePair;
  }>();

  // Process each file pair
  for (let i = 0; i < filePairs.length; i++) {
    const pair = filePairs[i];

    try {
      // Read files as text
      const designContent = await pair.designFile.text();
      const metadataContent = await pair.metadataFile.text();

      // Parse metadata
      const metadata = await providerTool.parseMetadata(metadataContent);

      // Verify checksum (pass filename to help detect PDB files)
      const matchResult = await providerTool.designAndMetadataMatch(designContent, metadataContent, pair.designFile.name);
      if (!matchResult.matches) {
        const errorMsg = matchResult.error === 'DECRYPTION_ERROR'
          ? `Decryption error for ${pair.designName}`
          : `Design and metadata checksum mismatch for ${pair.designName}`;
        console.warn(`${errorMsg}, skipping`);
        // Continue processing other pairs, but log the issue
        continue;
      }

      // Compute revisions (pass filename to help detect PDB files)
      const revisionsResponse = await providerTool.computeRevisions(designContent, metadataContent, pair.designFile.name);
      if (revisionsResponse.error) {
        console.warn(`Error computing revisions for ${pair.designName}, skipping`);
        continue;
      }

      console.log(`Computed ${revisionsResponse.revisions.length} revisions for ${pair.designName}`);

      // Extend revisions with metadata information
      const extendedRevisions: ExtendedRevision[] = revisionsResponse.revisions.map(rev => ({
        ...rev,
        metadataId: revisionsResponse.id,
        metadataParentId: revisionsResponse.parentMetadataId || null,
        designName: revisionsResponse.designName,
        filePairIndex: i,
      }));

      revisions.push(...extendedRevisions);
      console.log(`Total revisions after ${pair.designName}: ${revisions.length}`);

      // Store in metadata map
      metadataMap.set(revisionsResponse.id, {
        metadata,
        revisions: extendedRevisions,
        filePair: pair,
      });
    } catch (error) {
      console.error(`Error processing file pair ${pair.designName}:`, error);
      if (error instanceof Error) {
        console.error(`Error stack:`, error.stack);
      }
      // Continue with other pairs
    }
  }

  console.log(`buildUnifiedGraph: Total revisions collected: ${revisions.length}`);

  // Build cross-references by looking for PASTE operations with copied_from
  for (const revision of revisions) {
    if (revision.operationCode === 'PASTE' && revision.operationDetails?.copied_from) {
      const copiedFromId = revision.operationDetails.copied_from;

      // Find the revision in the referenced metadata file
      const referencedMetadata = metadataMap.get(copiedFromId);
      if (referencedMetadata) {
        // Find the COPY operation in the referenced metadata's revisions
        const copyRevisions = referencedMetadata.revisions.filter(
          r => r.operationCode === 'COPY'
        );

        if (copyRevisions.length > 0) {
          const firstCopy = copyRevisions.sort((a, b) => a.revision - b.revision)[0];

          crossReferences.push({
            fromRevision: revision,
            toRevision: firstCopy,
            referenceType: 'copied_from',
            referenceMetadata: {
              copiedFromMetadataId: copiedFromId,
            },
          });
        }
      }
    }
  }

  return {
    revisions,
    crossReferences,
    metadataMap,
  };
}

/**
 * Get all root metadata IDs (those with no parent)
 */
export function getRootMetadataIds(graph: UnifiedGraph): string[] {
  const rootIds: string[] = [];

  graph.metadataMap.forEach((data, metadataId) => {
    if (!data.metadata.parentMetadataId || data.metadata.parentMetadataId === '') {
      rootIds.push(metadataId);
    }
  });

  return rootIds;
}

/**
 * Get all child metadata IDs for a given parent metadata ID
 */
export function getChildMetadataIds(graph: UnifiedGraph, parentMetadataId: string): string[] {
  const childIds: string[] = [];

  graph.metadataMap.forEach((data, metadataId) => {
    if (data.metadata.parentMetadataId === parentMetadataId) {
      childIds.push(metadataId);
    }
  });

  return childIds;
}

/**
 * Get the file pair for a given revision
 */
export function getFilePairForRevision(
  graph: UnifiedGraph,
  revision: ExtendedRevision
): FilePair | null {
  const metadataData = graph.metadataMap.get(revision.metadataId);
  return metadataData?.filePair || null;
}

/**
 * Get all revisions for a given metadata ID
 */
export function getRevisionsForMetadata(
  graph: UnifiedGraph,
  metadataId: string
): ExtendedRevision[] {
  const metadataData = graph.metadataMap.get(metadataId);
  return metadataData?.revisions || [];
}
