/**
 * Graph clustering utilities for grouping revisions into sets
 */

import { Revision } from '../ProviderTool';

export interface RevisionCluster {
  type: 'single' | 'set';
  revision?: number; // For single nodes
  startRevision?: number; // For sets
  endRevision?: number; // For sets
  revisions: Revision[]; // All revisions in this cluster
}

const MAX_REVISIONS_PER_SET = 100;
const SPLIT_OPERATION_CODE = ['SPLIT', 'COPY', 'PASTE'];
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000; // Milliseconds in a year

/**
 * Checks if two timestamps are more than a year apart
 */
function isMoreThanYearApart(timestamp1: string, timestamp2: string): boolean {
  try {
    const date1 = new Date(timestamp1);
    const date2 = new Date(timestamp2);
    const diff = Math.abs(date2.getTime() - date1.getTime());
    return diff > ONE_YEAR_MS;
  } catch (error) {
    // If timestamp parsing fails, don't split
    return false;
  }
}

/**
 * Clusters revisions into single nodes and revision sets based on rules:
 * - First and last revisions are always separate nodes
 * - Intermediate revisions are grouped into sets (max 100 per set)
 * - Sets are split on SPLIT operations
 * - Sets are split if consecutive revisions are more than a year apart
 * 
 * @param revisions - Array of revisions (should be sorted by revision number)
 * @returns Array of clusters (single nodes or revision sets)
 */
export function clusterRevisions(revisions: Revision[]): RevisionCluster[] {
  if (revisions.length === 0) {
    return [];
  }

  // Edge cases: 1 or 2 revisions
  if (revisions.length === 1) {
    return [{
      type: 'single',
      revision: revisions[0].revision,
      revisions: [revisions[0]],
    }];
  }

  if (revisions.length === 2) {
    return [
      {
        type: 'single',
        revision: revisions[0].revision,
        revisions: [revisions[0]],
      },
      {
        type: 'single',
        revision: revisions[1].revision,
        revisions: [revisions[1]],
      },
    ];
  }

  // Sort revisions by revision number (ascending)
  const sorted = [...revisions].sort((a, b) => a.revision - b.revision);
  const firstRevision = sorted[0];
  const lastRevision = sorted[sorted.length - 1];
  const middleRevisions = sorted.slice(1, -1);

  const clusters: RevisionCluster[] = [];

  // Always add first revision as a single node
  clusters.push({
    type: 'single',
    revision: firstRevision.revision,
    revisions: [firstRevision],
  });

  // Cluster middle revisions
  if (middleRevisions.length > 0) {
    let currentSet: Revision[] = [];
    let setStartRevision = middleRevisions[0].revision;

    for (let i = 0; i < middleRevisions.length; i++) {
      const revision = middleRevisions[i];

      // Check if we should split on SPLIT
      const shouldSplit = SPLIT_OPERATION_CODE.includes(revision.operationCode);

      // Check if adding this revision would exceed max size
      const wouldExceedMax = currentSet.length >= MAX_REVISIONS_PER_SET;

      // Check if this revision is more than a year apart from the last revision in the current set
      const isTimeGap = currentSet.length > 0 &&
        isMoreThanYearApart(currentSet[currentSet.length - 1].timestamp, revision.timestamp);

      if (shouldSplit || wouldExceedMax || isTimeGap) {
        // Finalize current set if it has revisions
        if (currentSet.length > 0) {
          // If set has only one revision, treat it as a single node
          if (currentSet.length === 1) {
            clusters.push({
              type: 'single',
              revision: currentSet[0].revision,
              revisions: [...currentSet],
            });
          } else {
            clusters.push({
              type: 'set',
              startRevision: setStartRevision,
              endRevision: currentSet[currentSet.length - 1].revision,
              revisions: [...currentSet],
            });
          }
          currentSet = [];
        }

        // If split on SPLIT, add it as a single node
        if (shouldSplit) {
          clusters.push({
            type: 'single',
            revision: revision.revision,
            revisions: [revision],
          });
          // Set next set start to the revision after this one (if any)
          if (i < middleRevisions.length - 1) {
            setStartRevision = middleRevisions[i + 1].revision;
          }
        } else {
          // Start new set with current revision
          currentSet.push(revision);
          setStartRevision = revision.revision;
        }
      } else {
        // Add to current set
        currentSet.push(revision);
      }
    }

    // Finalize any remaining set
    if (currentSet.length > 0) {
      // If set has only one revision, treat it as a single node
      if (currentSet.length === 1) {
        clusters.push({
          type: 'single',
          revision: currentSet[0].revision,
          revisions: [...currentSet],
        });
      } else {
        clusters.push({
          type: 'set',
          startRevision: setStartRevision,
          endRevision: currentSet[currentSet.length - 1].revision,
          revisions: [...currentSet],
        });
      }
    }
  }

  // Always add last revision as a single node
  clusters.push({
    type: 'single',
    revision: lastRevision.revision,
    revisions: [lastRevision],
  });

  return clusters;
}

