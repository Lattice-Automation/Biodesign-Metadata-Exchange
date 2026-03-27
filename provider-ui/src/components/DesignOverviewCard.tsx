import React from 'react';
import { Box, Card, CardContent, Typography, Stack, Chip } from '@mui/material';
import FileUploadZone from './FileUploadZone';
import { GenBankSummary, PDBSummary, FASTASummary, isGenBank, isPDB, isFASTA, UI_LABELS } from '../utils';

type DesignSummary = GenBankSummary | PDBSummary | FASTASummary;

interface DesignOverviewCardProps {
    designFile: File | null;
    designSummary: DesignSummary | null;
    onClear: () => void;
    onClick: () => void;
    onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
    onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
    onDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
    isDragging: boolean;
}

const DesignOverviewCard: React.FC<DesignOverviewCardProps> = ({
    designFile,
    designSummary,
    onClear,
    onClick,
    onDrop,
    onDragOver,
    onDragLeave,
    isDragging,
}) => {
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
                        <Typography variant="h6">{UI_LABELS.DESIGN_OVERVIEW}</Typography>
                        {designFile && (
                            <Chip
                                label={designFile.name}
                                onDelete={(event) => {
                                    event.stopPropagation();
                                    onClear();
                                }}
                            />
                        )}
                    </Box>
                    {!designFile && (
                        <Typography color="text.secondary">
                            Drop a design file (.gb, .gbk, .pdb, .fasta) here (or click to browse)
                        </Typography>
                    )}
                    {designFile && !designSummary && (
                        <Typography color="text.secondary">{UI_LABELS.READING_FILE}</Typography>
                    )}
                    {designSummary && (
                        <Stack spacing={1}>
                            {isGenBank(designFile?.name) && 'locus' in designSummary && (
                                <>
                                    <Typography variant="body2"><strong>LOCUS:</strong> {designSummary.locus ?? 'N/A'}</Typography>
                                    <Typography variant="body2"><strong>DEFINITION:</strong> {designSummary.definition ?? 'N/A'}</Typography>
                                    <Typography variant="body2"><strong>ACCESSION:</strong> {designSummary.accession ?? 'N/A'}</Typography>
                                    <Typography variant="body2"><strong>VERSION:</strong> {designSummary.version ?? 'N/A'}</Typography>
                                    <Typography variant="body2"><strong>SOURCE:</strong> {designSummary.source ?? 'N/A'}</Typography>
                                    <Typography variant="body2"><strong>ORGANISM:</strong> {designSummary.organism ?? 'N/A'}</Typography>
                                </>
                            )}
                            {isPDB(designFile?.name) && 'header' in designSummary && (
                                <>
                                    <Typography variant="body2"><strong>HEADER:</strong> {designSummary.header ?? 'N/A'}</Typography>
                                    <Typography variant="body2"><strong>TITLE:</strong> {designSummary.title ?? 'N/A'}</Typography>
                                    <Typography variant="body2"><strong>COMPOUND:</strong> {designSummary.compound ?? 'N/A'}</Typography>
                                    <Typography variant="body2"><strong>SOURCE:</strong> {designSummary.source ?? 'N/A'}</Typography>
                                    <Typography variant="body2"><strong>AUTHOR:</strong> {designSummary.author ?? 'N/A'}</Typography>
                                </>
                            )}
                            {isFASTA(designFile?.name) && 'id' in designSummary && (
                                <>
                                    <Typography variant="body2"><strong>ID:</strong> {designSummary.id ?? 'N/A'}</Typography>
                                    <Typography variant="body2"><strong>DESCRIPTION:</strong> {designSummary.description ?? 'N/A'}</Typography>
                                    <Typography variant="body2"><strong>LENGTH:</strong> {designSummary.length ?? 'N/A'} bp</Typography>
                                </>
                            )}
                        </Stack>
                    )}
                </CardContent>
            </Card>
        </FileUploadZone>
    );
};

export default DesignOverviewCard;

