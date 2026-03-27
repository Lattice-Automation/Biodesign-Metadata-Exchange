import React, { useMemo } from 'react';
import { Box, Card, CardContent, Typography, Stack, Chip } from '@mui/material';
import { FileUploadZone } from './';
import { ComputeRevisionsResponse, UI_LABELS, UnifiedGraph, Revision } from '../utils';
import type { EvaluationResult } from '../utils/resultsUtils';

interface MetadataOverviewCardProps {
    metadataFile: File | null;
    computeRevisionsResponse: ComputeRevisionsResponse | null;
    unifiedGraph?: UnifiedGraph | null;
    selectedOperation?: Revision | undefined;
    evaluationResult?: EvaluationResult | null;
    isFetching: boolean;
    onClear: () => void;
    onClick: () => void;
    onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
    onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
    onDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
    isDragging: boolean;
}

const MetadataOverviewCard: React.FC<MetadataOverviewCardProps> = ({
    metadataFile,
    computeRevisionsResponse,
    unifiedGraph,
    selectedOperation,
    evaluationResult,
    isFetching,
    onClear,
    onClick,
    onDrop,
    onDragOver,
    onDragLeave,
    isDragging,
}) => {
    // Compute metadata response for selected operation if available, otherwise use computeRevisionsResponse
    const displayMetadata = useMemo(() => {
        if (selectedOperation && unifiedGraph) {
            const extendedRev = selectedOperation as any;
            const metadataData = unifiedGraph.metadataMap.get(extendedRev.metadataId);
            if (metadataData) {
                const metadataRevisions = metadataData.revisions;
                return {
                    id: extendedRev.metadataId,
                    parentMetadataId: metadataData.metadata.parentMetadataId || '',
                    designName: metadataData.metadata.designName || '',
                    author: metadataData.metadata.author,
                    description: metadataData.metadata.description,
                    lastUpdated: metadataData.metadata.lastUpdated,
                    revisions: metadataRevisions.map(r => ({
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
                } as ComputeRevisionsResponse;
            }
        }
        return computeRevisionsResponse;
    }, [selectedOperation, unifiedGraph, computeRevisionsResponse]);
    return (
        <FileUploadZone
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            isDragging={isDragging}
            sx={{ flex: 1, display: 'flex' }}
        >
            <Card
                onClick={onClick}
                sx={{ flex: 1, cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
            >
                <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="h6">{UI_LABELS.METADATA_OVERVIEW}</Typography>
                        {(metadataFile || evaluationResult) && (
                            <Chip
                                label={metadataFile?.name || 'results.json'}
                                color="secondary"
                                onDelete={(event) => {
                                    event.stopPropagation();
                                    onClear();
                                }}
                            />
                        )}
                    </Box>
                    {!metadataFile && !evaluationResult && (
                        <Typography color="text.secondary">
                            Drop a metadata file (.txt or .json) or results.json here (or click to browse)
                        </Typography>
                    )}
                    {(metadataFile || evaluationResult) && !displayMetadata && (
                        <Typography color="text.secondary">
                            {isFetching ? UI_LABELS.DECRYPTING_METADATA : UI_LABELS.WAITING_FOR_GENBANK}
                        </Typography>
                    )}
                    {displayMetadata && (
                        <Stack spacing={1}>
                            {evaluationResult?.summary?.finalRecommendation && (
                                <Chip
                                    label={`Recommendation: ${evaluationResult.summary.finalRecommendation.replace(/_/g, ' ')}`}
                                    size="small"
                                    color={evaluationResult.summary.finalRecommendation === 'likely_safe' ? 'success' : evaluationResult.summary.finalRecommendation === 'likely_unsafe' ? 'error' : 'default'}
                                    sx={{ alignSelf: 'flex-start', mb: 0.5 }}
                                />
                            )}
                            {evaluationResult?.summary?.screeningStatusCounts && Object.keys(evaluationResult.summary.screeningStatusCounts).length > 0 && (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                                    {Object.entries(evaluationResult.summary.screeningStatusCounts).map(([status, count]) => (
                                        <Chip key={status} label={`${status}: ${count}`} size="small" variant="outlined" />
                                    ))}
                                </Box>
                            )}
                            <Typography variant="body2"><strong>Id:</strong> {displayMetadata.id}</Typography>
                            <Typography variant="body2"><strong>Parent Id:</strong> {displayMetadata.parentMetadataId || 'N/A'}</Typography>
                            <Typography variant="body2"><strong>Design Name:</strong> {displayMetadata.designName}</Typography>
                            <Typography variant="body2"><strong>Author:</strong> {displayMetadata.author}</Typography>
                            <Typography variant="body2"><strong>Last Updated:</strong> {displayMetadata.lastUpdated}</Typography>
                        </Stack>
                    )}
                </CardContent>
            </Card>
        </FileUploadZone>
    );
};

export default MetadataOverviewCard;

