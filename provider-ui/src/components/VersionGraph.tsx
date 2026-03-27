import React, { useMemo, useCallback, useState } from 'react';
import { Box, Card, CardContent, Typography, IconButton, Tooltip } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import ReactFlow, {
    Controls,
    MiniMap,
    ReactFlowProvider,
    MarkerType,
    type Edge,
    type Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Revision, UI_LABELS, UnifiedGraph, buildMultiTreeGraph } from '../utils';
import { clusterRevisions } from '../utils/graphClustering';
import RevisionNode from './RevisionNode';
import RevisionSetNode from './RevisionSetNode';
import FileUploadZone from './FileUploadZone';
import type { RevisionNodeData } from './RevisionNode';
import type { RevisionSetNodeData } from './RevisionSetNode';
import type { GraphNodeData, GraphSetNodeData } from '../utils/graphLayout';

import type { ComputeRevisionsResponse } from '../ProviderTool';

interface VersionGraphProps {
    revisions: Revision[];
    unifiedGraph?: UnifiedGraph | null; // Optional unified graph for multi-file support
    computeRevisionsResponse?: ComputeRevisionsResponse | null; // For linear layout fallback
    designFile: File | null;
    metadataFile: File | null;
    isFetching: boolean;
    selectedRevisionKey: string | null; // Format: "${metadataId}-${revision}" or just "${revision}" for single file
    onNodeClick: (revisionKey: string) => void; // Format: "${metadataId}-${revision}" or just "${revision}" for single file
    onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
    onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
    onDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
    isDragging: boolean;
    onExport?: () => void;
}

const VersionGraph: React.FC<VersionGraphProps> = ({
    revisions,
    unifiedGraph,
    computeRevisionsResponse,
    designFile,
    metadataFile,
    isFetching,
    selectedRevisionKey,
    onNodeClick,
    onDrop,
    onDragOver,
    onDragLeave,
    isDragging,
    onExport,
}) => {
    // Track selected revision per set node (persists across node selections)
    const [setNodeSelections, setSetNodeSelections] = useState<Map<string, number>>(new Map());

    // Use multi-tree layout if unifiedGraph is provided, otherwise use linear clustering
    const useMultiTreeLayout = unifiedGraph !== null && unifiedGraph !== undefined;

    // Build multi-tree graph if unifiedGraph is available
    // Apply modifications from revisions prop to unifiedGraph before building
    const multiTreeGraph = useMemo(() => {
        if (!useMultiTreeLayout || !unifiedGraph) return null;
        
        // Create a modified unifiedGraph with updated revisions
        const updatedMetadataMap = new Map();
        unifiedGraph.metadataMap.forEach((value, key) => {
            // Find all revisions for this metadataId from the modified revisions
            const modifiedRevisions = revisions
                .filter((r: any) => (r as any).metadataId === key)
                .map((r: any) => ({
                    ...r,
                    metadataId: key,
                }));
            
            // If we have modified revisions, use them; otherwise keep original
            updatedMetadataMap.set(key, {
                ...value,
                revisions: modifiedRevisions.length > 0 
                    ? modifiedRevisions 
                    : value.revisions,
            });
        });
        
        const finalModifiedGraph = {
            ...unifiedGraph,
            revisions: revisions as any[], // Use the modified revisions
            metadataMap: updatedMetadataMap,
        };
        
        return buildMultiTreeGraph(finalModifiedGraph, selectedRevisionKey, onNodeClick);
    }, [useMultiTreeLayout, unifiedGraph, selectedRevisionKey, onNodeClick, revisions]);

    // Cluster revisions (linear layout fallback)
    const clusters = useMemo(() => {
        if (useMultiTreeLayout || revisions.length === 0) return [];
        return clusterRevisions(revisions);
    }, [revisions, useMultiTreeLayout]);

    // Handle revision selection from set nodes (for linear layout - uses revision number only)
    const handleSetNodeRevisionSelect = useCallback((setId: string, revision: number) => {
        setSetNodeSelections(prev => {
            const newMap = new Map(prev);
            newMap.set(setId, revision);
            return newMap;
        });
        // For linear layout, use just revision number as key (no metadataId available)
        onNodeClick(revision.toString());
    }, [onNodeClick]);

    // Create nodes from clusters (linear layout fallback)
    const linearNodes: Node<RevisionNodeData | RevisionSetNodeData>[] = useMemo(() => {
        if (useMultiTreeLayout) return [];
        const spacing = 300;
        return clusters.map((cluster, index) => {
            const nodeId = cluster.type === 'single' 
                ? `revision-${cluster.revision}`
                : `set-${cluster.startRevision}-${cluster.endRevision}`;
            
            // For linear layout, compare using revision number only (selectedRevisionKey is just revision number as string)
            const isSelected = cluster.type === 'single'
                ? selectedRevisionKey === (cluster.revision ?? 0).toString()
                : cluster.revisions.some(r => selectedRevisionKey === r.revision.toString());

            if (cluster.type === 'single') {
                const revision = cluster.revisions[0];
                return {
                    id: nodeId,
                    position: { x: index * spacing, y: 0 },
                    data: {
                        revision: revision.revision,
                        operationCode: revision.operationCode,
                        timestamp: revision.timestamp,
                        status: revision.status,
                        designName: computeRevisionsResponse?.designName,
                    } as RevisionNodeData,
                    type: 'revision',
                    draggable: false,
                    selectable: true,
                    selected: isSelected,
                };
            } else {
                // For set nodes, use persisted selection or default to first revision
                // If the global selectedRevision is in this set, use it; otherwise use persisted or first
                const setId = nodeId;
                let defaultSelectedRevision = cluster.revisions[0].revision;
                
                // Check if we have a persisted selection for this set
                const persistedSelection = setNodeSelections.get(setId);
                if (persistedSelection) {
                    // Verify the persisted revision is still in this set
                    const persistedInSet = cluster.revisions.find(r => r.revision === persistedSelection);
                    if (persistedInSet) {
                        defaultSelectedRevision = persistedSelection;
                    }
                }
                
                // If the global selectedRevisionKey is in this set, use it (but don't override persisted)
                if (selectedRevisionKey !== null && !persistedSelection) {
                    const selectedInSet = cluster.revisions.find(r => selectedRevisionKey === r.revision.toString());
                    if (selectedInSet) {
                        defaultSelectedRevision = selectedInSet.revision;
                    }
                }

                return {
                    id: nodeId,
                    position: { x: index * spacing, y: 0 },
                    data: {
                        startRevision: cluster.startRevision!,
                        endRevision: cluster.endRevision!,
                        revisions: cluster.revisions,
                        selectedRevision: defaultSelectedRevision,
                        designName: computeRevisionsResponse?.designName,
                        onRevisionSelect: ((revisionKey: string) => {
                            // For linear layout, revisionKey is just the revision number as string
                            const revision = parseInt(revisionKey, 10);
                            handleSetNodeRevisionSelect(setId, revision);
                        }) as ((revision: number) => void) | ((revisionKey: string) => void),
                    } as RevisionSetNodeData,
                    type: 'revisionSet',
                    draggable: false,
                    selectable: true,
                    selected: isSelected,
                };
            }
        });
    }, [clusters, selectedRevisionKey, setNodeSelections, handleSetNodeRevisionSelect, useMultiTreeLayout, computeRevisionsResponse]);

    // Create edges between clusters (linear layout fallback)
    const linearEdges: Edge[] = useMemo(() => {
        if (useMultiTreeLayout || clusters.length < 2) return [];
        
        const edgesList: Edge[] = [];
        for (let i = 0; i < clusters.length - 1; i++) {
            const sourceCluster = clusters[i];
            const targetCluster = clusters[i + 1];
            
            const sourceId = sourceCluster.type === 'single'
                ? `revision-${sourceCluster.revision}`
                : `set-${sourceCluster.startRevision}-${sourceCluster.endRevision}`;
            
            const targetId = targetCluster.type === 'single'
                ? `revision-${targetCluster.revision}`
                : `set-${targetCluster.startRevision}-${targetCluster.endRevision}`;

            edgesList.push({
                id: `edge-${sourceId}-${targetId}`,
                source: sourceId,
                target: targetId,
                type: 'smoothstep',
                animated: false,
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: '#1976d2',
                },
                style: { strokeWidth: 2 },
            });
        }
        return edgesList;
    }, [clusters, useMultiTreeLayout]);

    // Use multi-tree graph nodes/edges if available, otherwise use linear
    const nodes = useMultiTreeLayout && multiTreeGraph ? multiTreeGraph.nodes : linearNodes;
    const edges = useMultiTreeLayout && multiTreeGraph ? multiTreeGraph.edges : linearEdges;

    const handleNodeClick = useCallback((_: React.MouseEvent, node: Node<RevisionNodeData | RevisionSetNodeData | GraphNodeData | GraphSetNodeData>) => {
        if (node.type === 'revision') {
            const data = node.data as RevisionNodeData | GraphNodeData;
            // Use revisionKey if available (multi-tree layout), otherwise fall back to revision number
            if ('revisionKey' in data && data.revisionKey) {
                onNodeClick(data.revisionKey);
            } else {
                onNodeClick(data.revision.toString());
            }
        } else if (node.type === 'revisionSet') {
            const data = node.data as RevisionSetNodeData | GraphSetNodeData;
            // Use revisionKey if available (multi-tree layout), otherwise fall back to revision number
            if ('revisionKey' in data && data.revisionKey) {
                onNodeClick(data.revisionKey);
            } else {
                onNodeClick(data.selectedRevision.toString());
            }
        }
    }, [onNodeClick]);

    // Close any open dropdowns when clicking on the ReactFlow pane
    const handlePaneClick = useCallback((event: React.MouseEvent) => {
        // Close all open selects by dispatching a custom event
        // Use a small delay to ensure this fires after any node click handlers
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('closeAllSelects'));
        }, 0);
    }, []);

    return (
        <FileUploadZone
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            isDragging={isDragging}
            sx={{
                minHeight: 400, // Doubled from 320
                display: 'flex'
            }}
        >
            <Card sx={{ flex: 1, display: 'flex' }}>
                <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 400 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="h6">
                            {UI_LABELS.VERSION_GRAPH}
                        </Typography>
                        {onExport && revisions.length > 0 && (
                            <Tooltip title={<div>Export metadata and design files<br />(with new comments/status flags)</div>}>
                                <IconButton
                                    onClick={onExport}
                                    color="primary"
                                    size="medium"
                                >
                                    <DownloadIcon fontSize="medium" />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Box>
                    {!designFile && !metadataFile && revisions.length === 0 ? (
                        <Box flex={1} display="flex" alignItems="center" justifyContent="center" textAlign="center" color="text.secondary">
                            <Typography>{UI_LABELS.DROP_FILES}</Typography>
                        </Box>
                    ) : isFetching && revisions.length === 0 ? (
                        <Box flex={1} display="flex" alignItems="center" justifyContent="center" color="text.secondary">
                            <Typography>{UI_LABELS.BUILDING_GRAPH}</Typography>
                        </Box>
                    ) : revisions.length === 0 ? (
                        <Box flex={1} display="flex" alignItems="center" justifyContent="center" color="text.secondary">
                            <Typography>{UI_LABELS.NO_REVISIONS}</Typography>
                        </Box>
                    ) : (
                        <ReactFlowProvider>
                            <Box sx={{ flex: 1, minHeight: 0, height: '100%' }}>
                                <ReactFlow
                                    nodes={nodes}
                                    edges={edges}
                                    nodeTypes={{ 
                                        revision: RevisionNode,
                                        revisionSet: RevisionSetNode,
                                    }}
                                    fitView
                                    fitViewOptions={{ padding: 0.2 }}
                                    onNodeClick={handleNodeClick}
                                    onPaneClick={handlePaneClick}
                                    className="design-graph-flow"
                                    proOptions={{ hideAttribution: true }}
                                    style={{ width: '100%', height: '100%' }}
                                >
                                    <MiniMap pannable zoomable />
                                    <Controls />
                                </ReactFlow>
                            </Box>
                        </ReactFlowProvider>
                    )}
                </CardContent>
            </Card>
        </FileUploadZone>
    );
};

export default VersionGraph;

