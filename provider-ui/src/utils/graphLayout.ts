/**
 * Graph layout utilities for building multiple separate linear trees from unified graphs
 */

import { UnifiedGraph, ExtendedRevision, getRootMetadataIds, getChildMetadataIds } from './graphConstruction';
import { RevisionCluster, clusterRevisions } from './graphClustering';
import type { Node, Edge } from 'reactflow';
import { MarkerType } from 'reactflow';

export interface GraphNodeData {
  revision: number;
  operationCode: string;
  timestamp: string;
  status: string;
  metadataId: string;
  designName: string;
  revisionKey: string; // Composite key: "${metadataId}-${revision}"
  onRevisionSelect: (revisionKey: string) => void;
}

export interface GraphSetNodeData {
  startRevision: number;
  endRevision: number;
  revisions: ExtendedRevision[];
  selectedRevision: number;
  metadataId: string;
  designName: string;
  revisionKey: string; // Composite key: "${metadataId}-${selectedRevision}"
  onRevisionSelect: (revisionKey: string) => void; // Format: "${metadataId}-${revision}"
}

/**
 * Builds multiple separate linear trees from unified graph
 * Each metadata file gets its own linear tree, positioned separately
 */
export function buildMultiTreeGraph(
  unifiedGraph: UnifiedGraph,
  selectedRevisionKey: string | null, // Format: "${metadataId}-${revision}"
  onRevisionSelect: (revisionKey: string) => void // Format: "${metadataId}-${revision}"
): { nodes: Node<GraphNodeData | GraphSetNodeData>[]; edges: Edge[] } {
  const nodes: Node<GraphNodeData | GraphSetNodeData>[] = [];
  const edges: Edge[] = [];

  // Layout parameters
  const horizontalSpacing = 350;
  const verticalSpacing = 150; // Space between different metadata file trees
  const childOffsetX = 350; // Horizontal offset for child trees (slightly to the right)
  const rootTreeSpacing = 150; // Vertical spacing between root trees

  const startX = 0; // All root trees start at the same X position (left-aligned)
  const copyPasteOffset = 350; // Horizontal offset to position PASTE node to the right of COPY node
  let currentY = 0;

  // Map to track node IDs for each revision (for creating SPLIT-to-CREATE edges)
  const revisionNodeMap = new Map<string, string>(); // Maps (metadataId, revision) to nodeId

  // Recursive function to layout a metadata file as a linear tree
  const layoutMetadataFile = (
    metadataId: string,
    startX: number,
    startY: number
  ): { endX: number; endY: number; splitNodeId: string | null } => {
    const metadataData = unifiedGraph.metadataMap.get(metadataId);
    if (!metadataData) return { endX: startX, endY: startY, splitNodeId: null };

    // Get revisions for this metadata file and cluster them
    const revisions = metadataData.revisions.sort((a: ExtendedRevision, b: ExtendedRevision) => a.revision - b.revision);
    const clusters = clusterRevisions(revisions);

    let x = startX;
    let lastNodeId: string | null = null;
    let splitNodeId: string | null = null;
    let branchingNodeId: string | null = null; // Track any branching operation node

    // Create nodes for each cluster in this metadata file
    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      const nodeId = cluster.type === 'single'
        ? `revision-${metadataId}-${cluster.revision}`
        : `set-${metadataId}-${cluster.startRevision}-${cluster.endRevision}`;

      // Check if this cluster is selected using composite key (metadataId-revision)
      const isSelected = cluster.type === 'single'
        ? selectedRevisionKey === `${metadataId}-${cluster.revision}`
        : cluster.revisions.some(r => selectedRevisionKey === `${metadataId}-${r.revision}`);

      if (cluster.type === 'single') {
        const revision = cluster.revisions[0] as ExtendedRevision;

        // Track node ID for this revision
        revisionNodeMap.set(`${metadataId}-${revision.revision}`, nodeId);

        // Check if this is a branching operation (SPLIT, EXTRACT_BACKBONE, DESIGN_PROTEIN, TRANSLATE_PROTEIN)
        if (revision.operationCode === 'SPLIT') {
          splitNodeId = nodeId;
          branchingNodeId = nodeId;
        } else if (revision.operationCode === 'EXTRACT_BACKBONE' ||
          revision.operationCode === 'DESIGN_PROTEIN' ||
          revision.operationCode === 'TRANSLATE_PROTEIN') {
          branchingNodeId = nodeId;
        }

        nodes.push({
          id: nodeId,
          position: { x, y: startY },
          data: {
            revision: revision.revision,
            operationCode: revision.operationCode,
            timestamp: revision.timestamp,
            status: revision.status || '',
            metadataId: revision.metadataId,
            designName: revision.designName,
            revisionKey: `${metadataId}-${revision.revision}`, // Composite key for selection
            onRevisionSelect, // Pass the handler for clicking
          } as GraphNodeData,
          type: 'revision',
          draggable: false,
          selectable: true,
          selected: isSelected,
        });
      } else {
        // For set nodes, default to first revision
        let defaultSelectedRevision = cluster.revisions[0].revision;
        if (selectedRevisionKey !== null) {
          // Find if any revision in this set matches the selected key
          const selectedInSet = cluster.revisions.find(r => selectedRevisionKey === `${metadataId}-${r.revision}`);
          if (selectedInSet) {
            defaultSelectedRevision = selectedInSet.revision;
          }
        }

        // Check if any revision in this set is a branching operation
        const branchingOps = ['SPLIT', 'EXTRACT_BACKBONE', 'DESIGN_PROTEIN', 'TRANSLATE_PROTEIN'];
        const hasBranchingOp = cluster.revisions.some((r) =>
          branchingOps.includes((r as ExtendedRevision).operationCode)
        );
        if (hasBranchingOp) {
          // Find the branching operation revision (prioritize SPLIT, then others)
          let branchingRevision = cluster.revisions.find((r) =>
            (r as ExtendedRevision).operationCode === 'SPLIT'
          ) as ExtendedRevision | undefined;
          if (!branchingRevision) {
            branchingRevision = cluster.revisions.find((r) =>
              (r as ExtendedRevision).operationCode === 'EXTRACT_BACKBONE' ||
              (r as ExtendedRevision).operationCode === 'DESIGN_PROTEIN' ||
              (r as ExtendedRevision).operationCode === 'TRANSLATE_PROTEIN'
            ) as ExtendedRevision | undefined;
          }
          if (branchingRevision) {
            if (branchingRevision.operationCode === 'SPLIT') {
              splitNodeId = nodeId;
            }
            branchingNodeId = nodeId;
            revisionNodeMap.set(`${metadataId}-${branchingRevision.revision}`, nodeId);
          }
        }

        nodes.push({
          id: nodeId,
          position: { x, y: startY },
          data: {
            startRevision: cluster.startRevision!,
            endRevision: cluster.endRevision!,
            revisions: cluster.revisions,
            selectedRevision: defaultSelectedRevision,
            metadataId: metadataId,
            designName: metadataData.filePair?.designName ?? metadataData.metadata.designName ?? 'Unknown',
            revisionKey: `${metadataId}-${defaultSelectedRevision}`, // Composite key for selection
            onRevisionSelect, // Pass the handler for selecting revisions
          } as GraphSetNodeData,
          type: 'revisionSet',
          draggable: false,
          selectable: true,
          selected: isSelected,
        });
      }

      // Create edge from previous node in this metadata file
      if (lastNodeId) {
        edges.push({
          id: `edge-${lastNodeId}-${nodeId}`,
          source: lastNodeId,
          target: nodeId,
          type: 'smoothstep',
          animated: false,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#1976d2',
          },
          style: { strokeWidth: 2 },
        });
      }

      lastNodeId = nodeId;
      x += horizontalSpacing;
    }

    // Layout children metadata files below and to the right of branching operations
    // Branching operations: SPLIT, EXTRACT_BACKBONE, DESIGN_PROTEIN, TRANSLATE_PROTEIN
    const childIds = getChildMetadataIds(unifiedGraph, metadataId);
    let maxChildY = startY;

    if (childIds.length > 0 && branchingNodeId) {
      // Position children below and slightly to the right of the branching operation node
      const branchingNode = nodes.find(n => n.id === branchingNodeId);
      const branchingX = branchingNode ? branchingNode.position.x : x;
      const childStartX = branchingX + childOffsetX;
      let currentChildY = startY + verticalSpacing;

      // Sources that indicate branching children
      const branchingSources = [
        'tool_split_operation',
        'tool_extract_backbone_operation',
        'tool_design_protein_operation',
        'tool_translate_protein_operation'
      ];

      for (const childId of childIds) {
        const childMetadataData = unifiedGraph.metadataMap.get(childId);
        if (childMetadataData) {
          // Find the CREATE/CREATE_PROTEIN operation in the child with a branching source
          const childRevisions = childMetadataData.revisions.sort((a: ExtendedRevision, b: ExtendedRevision) => a.revision - b.revision);
          const createRevision = childRevisions.find((r: ExtendedRevision) =>
            (r.operationCode === 'CREATE' || r.operationCode === 'CREATE_PROTEIN') &&
            r.operationDetails?.source &&
            branchingSources.includes(r.operationDetails.source)
          );

          if (createRevision) {
            // Layout the child metadata file at the current Y position
            const childLayout = layoutMetadataFile(childId, childStartX, currentChildY);

            // Find the CREATE node in the child (should be the first node created)
            const createNodeId = revisionNodeMap.get(`${childId}-${createRevision.revision}`);
            if (createNodeId && branchingNodeId) {
              // Create edge from branching operation to child's CREATE
              edges.push({
                id: `edge-branch-${branchingNodeId}-to-${createNodeId}`,
                source: branchingNodeId,
                target: createNodeId,
                type: 'smoothstep',
                animated: false,
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  color: '#1976d2',
                },
                style: { strokeWidth: 2, strokeDasharray: '5,5' }, // Dashed for parent-child
              });
            }

            // Move to the next Y position for the next child (below this child's bottom)
            maxChildY = Math.max(maxChildY, childLayout.endY);
            currentChildY = maxChildY + verticalSpacing;
          }
        }
      }
    }

    return { endX: x, endY: Math.max(startY, maxChildY), splitNodeId: branchingNodeId || splitNodeId };
  };

  // Layout each root metadata file as a separate tree, stacked vertically
  // Each root tree and all its sub-branches must appear entirely above/below other root trees
  const rootIds = getRootMetadataIds(unifiedGraph);

  // Also get all metadata IDs that have parents but aren't branching operation children
  // Branching operations: SPLIT, EXTRACT_BACKBONE, DESIGN_PROTEIN, TRANSLATE_PROTEIN
  // These children should be laid out as separate trees (e.g., other parent-child relationships)
  const childMetadataIds = new Set<string>();
  unifiedGraph.metadataMap.forEach((data, metadataId) => {
    if (data.metadata.parentMetadataId && data.metadata.parentMetadataId !== '') {
      // Check if this is a branching operation child by looking for CREATE/CREATE_PROTEIN
      // with a branching source (same logic used in layoutMetadataFile)
      const revisions = data.revisions.sort((a: ExtendedRevision, b: ExtendedRevision) => a.revision - b.revision);
      const branchingSources = [
        'tool_split_operation',
        'tool_extract_backbone_operation',
        'tool_design_protein_operation',
        'tool_translate_protein_operation'
      ];
      const isBranchingChild = revisions.some((rev: ExtendedRevision) =>
        (rev.operationCode === 'CREATE' || rev.operationCode === 'CREATE_PROTEIN') &&
        rev.operationDetails?.source &&
        branchingSources.includes(rev.operationDetails.source)
      );

      if (!isBranchingChild) {
        // This is a child but not a branching operation child, so lay it out separately
        childMetadataIds.add(metadataId);
      }
    }
  });

  // Combine root IDs and non-SPLIT child IDs for layout
  const allMetadataIdsToLayout = [...rootIds, ...Array.from(childMetadataIds)];

  // Map to track which metadata files need to be shifted (for COPY/PASTE anchoring)
  const metadataShiftMap = new Map<string, number>(); // Maps metadataId to horizontal offset

  for (const metadataId of allMetadataIdsToLayout) {
    // Layout this metadata file tree and all its children (SPLIT sub-branches)
    // The layoutMetadataFile function recursively handles children and returns the maximum Y reached
    const layout = layoutMetadataFile(metadataId, startX, currentY);

    // Move to the next Y position below this entire tree (including all sub-branches)
    // Add extra spacing between trees
    currentY = layout.endY + rootTreeSpacing;
  }

  // Find COPY/PASTE pairs and calculate horizontal offsets for anchoring
  // Anchor the PASTE node's tree so the PASTE node is positioned to the right of the COPY node
  // Use the first PASTE operation if there are multiple
  const processedPasteMetadataIds = new Set<string>(); // Track which metadata files we've already processed

  for (const crossRef of unifiedGraph.crossReferences) {
    if (crossRef.referenceType === 'copied_from') {
      const copyRevision = crossRef.toRevision as ExtendedRevision; // COPY operation
      const pasteRevision = crossRef.fromRevision as ExtendedRevision; // PASTE operation

      // Only process the first PASTE operation for each metadata file
      if (processedPasteMetadataIds.has(pasteRevision.metadataId)) {
        continue;
      }

      // Find the node IDs for both COPY and PASTE operations
      const copyNodeId = revisionNodeMap.get(`${copyRevision.metadataId}-${copyRevision.revision}`);
      const pasteNodeId = revisionNodeMap.get(`${pasteRevision.metadataId}-${pasteRevision.revision}`);

      if (copyNodeId && pasteNodeId) {
        // Find the COPY and PASTE nodes
        const copyNode = nodes.find(n => n.id === copyNodeId);
        const pasteNode = nodes.find(n => n.id === pasteNodeId);

        if (copyNode && pasteNode) {
          // Calculate the offset needed to position PASTE node to the right of COPY node
          const targetPasteX = copyNode.position.x + copyPasteOffset;
          const currentPasteX = pasteNode.position.x;
          const offset = targetPasteX - currentPasteX;

          // Store the offset for the PASTE node's metadata file (and all its children)
          // We'll apply this offset to all nodes in this metadata file's tree
          metadataShiftMap.set(pasteRevision.metadataId, offset);
          processedPasteMetadataIds.add(pasteRevision.metadataId);

          // Also apply to any child metadata files (SPLIT children)
          const childIds = getChildMetadataIds(unifiedGraph, pasteRevision.metadataId);
          for (const childId of childIds) {
            metadataShiftMap.set(childId, offset);
          }
        }
      }
    }
  }

  // Apply horizontal shifts to nodes based on COPY/PASTE anchoring
  for (const node of nodes) {
    const nodeData = node.data as GraphNodeData | GraphSetNodeData;
    const metadataId = nodeData.metadataId;
    const shift = metadataShiftMap.get(metadataId);
    if (shift !== undefined) {
      node.position.x += shift;
    }
  }

  // Create edges for COPY/PASTE cross-references
  // These connect COPY operations in one tree to PASTE operations in another tree
  for (const crossRef of unifiedGraph.crossReferences) {
    if (crossRef.referenceType === 'copied_from') {
      const copyRevision = crossRef.toRevision as ExtendedRevision; // COPY operation
      const pasteRevision = crossRef.fromRevision as ExtendedRevision; // PASTE operation

      // Find the node IDs for both COPY and PASTE operations
      const copyNodeId = revisionNodeMap.get(`${copyRevision.metadataId}-${copyRevision.revision}`);
      const pasteNodeId = revisionNodeMap.get(`${pasteRevision.metadataId}-${pasteRevision.revision}`);

      if (copyNodeId && pasteNodeId) {
        // Create edge from COPY to PASTE
        // Use Bezier curve (default type) for a curvier path that stands out when crossing nodes
        edges.push({
          id: `edge-copy-${copyNodeId}-to-paste-${pasteNodeId}`,
          source: copyNodeId,
          target: pasteNodeId,
          type: 'default', // Bezier curve - naturally curvier than smoothstep
          animated: false,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#0d00ff', // Orange color to distinguish from regular edges
          },
          style: {
            strokeWidth: 3, // Thicker line to stand out
            strokeDasharray: '8,4', // Longer dashes for better visibility
            stroke: '#0d00ff' // Orange color
          },
        });
      }
    }
  }

  return { nodes, edges };
}
