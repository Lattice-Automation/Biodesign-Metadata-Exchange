import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    IconButton,
    Tabs,
    Tab,
    Tooltip,
    FormControlLabel,
    Switch,
    Divider,
    Stack,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    CircularProgress,
    Menu,
    MenuItem,
    ButtonGroup,
} from '@mui/material';
import { toast } from 'react-toastify';
import { parseFile } from 'seqparse';
import SeqViz from 'seqviz';
import ReactDiffViewer from 'react-diff-viewer-continued';
import CloseIcon from '@mui/icons-material/Close';
import FlagIcon from '@mui/icons-material/Flag';
import ClearIcon from '@mui/icons-material/Clear';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { ComputeRevisionsResponse, Revision, isGenBank, isPDB, isGenBankContent, isPDBContent, TOAST_MESSAGES, UI_LABELS, getSetting, performBlastSearch, formatBlastResults } from '../utils';
import { getStatusColor } from '../utils/resultsUtils';

interface VersionDetailsPanelProps {
    computeRevisionsResponse: ComputeRevisionsResponse | null;
    selectedOperation: Revision | undefined;
    previousOperation: Revision | undefined;
    designFile: File | null;
    selectedRevisionKey: string | null;
    onClearSelection: () => void;
    onStatusUpdate: (revisionKey: string | number, status: string) => void;
    onCommentAdd: (revisionKey: string | number, commentText: string) => void;
    onCommentDelete: (revisionKey: string | number, commentIndex: number) => void;
}

const VersionDetailsPanel: React.FC<VersionDetailsPanelProps> = ({
    computeRevisionsResponse,
    selectedOperation,
    previousOperation,
    designFile,
    selectedRevisionKey,
    onClearSelection,
    onStatusUpdate,
    onCommentAdd,
    onCommentDelete,
}) => {
    const [tabIndex, setTabIndex] = useState<number>(0);
    const [showLineNumbers, setShowLineNumbers] = useState(() => getSetting('showLineNumbers'));
    const [sequence, setSequence] = useState<string | null>(null);
    const [annotations, setAnnotations] = useState<any[] | null>(null);
    const [isProtein, setIsProtein] = useState(false);
    const [commentDialogOpen, setCommentDialogOpen] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [commentToDelete, setCommentToDelete] = useState<{ revisionKey: string | number; commentIndex: number } | null>(null);
    const [isBlastLoading, setIsBlastLoading] = useState(false);
    const [isScreenLoading, setIsScreenLoading] = useState(false);
    const [downloadMenuAnchor, setDownloadMenuAnchor] = useState<null | HTMLElement>(null);

    // Listen for settings changes
    useEffect(() => {
        const handleSettingsChange = (event: CustomEvent) => {
            const settings = event.detail;
            setShowLineNumbers(settings.showLineNumbers);
        };

        window.addEventListener('settingsChanged', handleSettingsChange as EventListener);

        return () => {
            window.removeEventListener('settingsChanged', handleSettingsChange as EventListener);
        };
    }, []);

    useEffect(() => {
        const loadSequence = async () => {
            if (!selectedOperation) {
                setSequence(null);
                setAnnotations(null);
                setIsProtein(false);
                return;
            }

            const isGenBankFormat = designFile ? isGenBank(designFile.name) : isGenBankContent(selectedOperation.design);
            const isProteinFormat = designFile ? isPDB(designFile.name) : isPDBContent(selectedOperation.design);

            if (isGenBankFormat) {
                try {
                    const parsed = await parseFile(selectedOperation.design);
                    if (parsed && parsed.length > 0) {
                        setSequence(parsed[0].seq);
                        setAnnotations(parsed[0].annotations);
                        setIsProtein(false);
                        return;
                    }
                } catch (error) {
                    toast.error(TOAST_MESSAGES.UNABLE_TO_READ_GENBANK);
                }
            }

            // For PDB files or other formats, show the raw content
            // PDB files are protein structures, so mark as protein
            if (isProteinFormat) {
                setSequence(selectedOperation.design);
                setAnnotations(null);
                setIsProtein(true);
            } else {
                // Fallback for other formats
                setSequence(selectedOperation.design);
                setAnnotations(null);
                setIsProtein(false);
            }
        };

        loadSequence();
    }, [selectedOperation, designFile]);

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabIndex(newValue);
    };

    const handleCommentSubmit = () => {
        if (selectedOperation && selectedRevisionKey && commentText.trim()) {
            onCommentAdd(selectedRevisionKey, commentText.trim());
            setCommentText('');
            setCommentDialogOpen(false);
        }
    };

    const handleStatusCycle = () => {
        if (!selectedOperation || !selectedRevisionKey) return;
        const raw = selectedOperation.status || '';
        const statuses = ['', 'flagged', 'marked_unsafe', 'marked_safe'];
        const toCycleIndex: Record<string, number> = {
            '': 0, default: 0, yellow: 1, flagged: 1, red: 2, marked_unsafe: 2, screening_failed: 2,
            green: 3, marked_safe: 3, screening_passed: 3,
        };
        const currentIndex = toCycleIndex[raw] ?? 0;
        const nextIndex = (currentIndex + 1) % statuses.length;
        onStatusUpdate(selectedRevisionKey, statuses[nextIndex]);
    };

    const handleDeleteClick = (revisionKey: string | number, commentIndex: number) => {
        setCommentToDelete({ revisionKey, commentIndex });
        setDeleteConfirmOpen(true);
    };

    const handleDeleteConfirm = () => {
        if (commentToDelete) {
            onCommentDelete(commentToDelete.revisionKey, commentToDelete.commentIndex);
            setCommentToDelete(null);
            setDeleteConfirmOpen(false);
        }
    };

    const handleBlastSearch = async () => {
        if (!selectedOperation || !sequence) {
            toast.error('No sequence available for BLAST search');
            return;
        }

        // Clean sequence - remove whitespace and newlines
        let cleanSequence = sequence.replace(/\s+/g, '').toUpperCase();
        
        // Check if this looks like PDB file content (contains PDB headers)
        if (isProtein && (cleanSequence.includes('HEADER') || cleanSequence.includes('ATOM') || cleanSequence.includes('COMPND'))) {
            toast.error('PDB file content detected. Please extract the protein sequence from the PDB file first. BLAST requires sequence data, not structure data.');
            return;
        }
        
        // Validate sequence contains only valid characters
        if (isProtein) {
            // Protein sequences should only contain amino acid letters
            const proteinRegex = /^[ACDEFGHIKLMNPQRSTVWY]+$/;
            if (!proteinRegex.test(cleanSequence)) {
                toast.error('Invalid protein sequence. Sequence must contain only standard amino acid letters (A, C, D, E, F, G, H, I, K, L, M, N, P, Q, R, S, T, V, W, Y).');
                return;
            }
        } else {
            // DNA sequences should only contain A, T, G, C, N
            const dnaRegex = /^[ATCGN]+$/;
            if (!dnaRegex.test(cleanSequence)) {
                toast.error('Invalid DNA sequence. Sequence must contain only A, T, G, C, or N.');
                return;
            }
        }
        
        if (cleanSequence.length === 0) {
            toast.error('Sequence is empty');
            return;
        }

        // Determine sequence type
        const sequenceType = isProtein ? 'protein' : 'dna';

        setIsBlastLoading(true);
        try {
            const result = await performBlastSearch(cleanSequence, sequenceType);
            
            if (result.error) {
                toast.error(`BLAST search failed: ${result.message || 'Unknown error'}`);
                return;
            }

            // Format results and add as comment
            const formattedResults = formatBlastResults(result);
            if (selectedRevisionKey) {
                onCommentAdd(selectedRevisionKey, formattedResults);
                toast.success('BLAST search completed and results added as comment');
            } else {
                toast.error('Unable to add comment: revision key not available');
            }
        } catch (error: any) {
            console.error('BLAST search error:', error);
            toast.error(`BLAST search failed: ${error.message || 'Unknown error'}`);
        } finally {
            setIsBlastLoading(false);
        }
    };

    const handleScreenVersion = async () => {
        if (!selectedOperation || !selectedRevisionKey) {
            toast.error('No operation selected for screening');
            return;
        }

        setIsScreenLoading(true);
        try {
            // Wait for 8 seconds
            await new Promise(resolve => setTimeout(resolve, 8000));

            // Add comment
            onCommentAdd(selectedRevisionKey, 'Not a sequence of concern');
            toast.success('Screening completed and results added as comment');
        } catch (error: any) {
            console.error('Screen version error:', error);
            toast.error(`Screening failed: ${error.message || 'Unknown error'}`);
        } finally {
            setIsScreenLoading(false);
        }
    };

    const handleCopySequence = async () => {
        if (!sequence) {
            toast.error('No sequence available to copy');
            return;
        }

        try {
            // For GenBank files, extract just the sequence (not the full GenBank format)
            let sequenceToCopy = sequence;
            if ((designFile ? isGenBank(designFile.name) : isGenBankContent(selectedOperation?.design)) && !isProtein) {
                // sequence is already extracted from GenBank, so use it directly
                sequenceToCopy = sequence;
            } else if (isProtein) {
                // For PDB files, copy the raw content
                sequenceToCopy = sequence;
            }

            await navigator.clipboard.writeText(sequenceToCopy);
            toast.success('Sequence copied to clipboard');
        } catch (error: any) {
            console.error('Copy error:', error);
            toast.error('Failed to copy sequence to clipboard');
        }
    };

    const handleDownloadMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setDownloadMenuAnchor(event.currentTarget);
    };

    const handleDownloadMenuClose = () => {
        setDownloadMenuAnchor(null);
    };

    const handleDownloadGenBank = () => {
        if (!selectedOperation) {
            toast.error('No operation selected');
            return;
        }

        try {
            const designContent = selectedOperation.design;
            const fileName = computeRevisionsResponse?.designName 
                ? `${computeRevisionsResponse.designName}_rev${selectedOperation.revision}.gb`
                : `design_rev${selectedOperation.revision}.gb`;

            const blob = new Blob([designContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success('GenBank file downloaded');
        } catch (error: any) {
            console.error('Download error:', error);
            toast.error('Failed to download GenBank file');
        }
        handleDownloadMenuClose();
    };

    const handleDownloadFASTA = () => {
        if (!sequence || !selectedOperation) {
            toast.error('No sequence available to download');
            return;
        }

        try {
            // Extract just the sequence (remove any GenBank formatting if present)
            let fastaSequence = sequence;
            if ((designFile ? isGenBank(designFile.name) : isGenBankContent(selectedOperation?.design)) && !isProtein) {
                // sequence is already extracted, use it directly
                fastaSequence = sequence;
            } else if (isProtein) {
                // For PDB, we can't really create a FASTA, but we can try to extract sequence
                toast.error('FASTA download not available for PDB files');
                handleDownloadMenuClose();
                return;
            }

            // Create FASTA format: >header\nsequence
            const designName = computeRevisionsResponse?.designName || 'sequence';
            const header = `>${designName}_rev${selectedOperation.revision}`;
            const fastaContent = `${header}\n${fastaSequence}`;

            const fileName = computeRevisionsResponse?.designName 
                ? `${computeRevisionsResponse.designName}_rev${selectedOperation.revision}.fasta`
                : `sequence_rev${selectedOperation.revision}.fasta`;

            const blob = new Blob([fastaContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success('FASTA file downloaded');
        } catch (error: any) {
            console.error('Download error:', error);
            toast.error('Failed to download FASTA file');
        }
        handleDownloadMenuClose();
    };

    return (
        <>
        <Card>
            <CardContent sx={{ display: 'flex', flexDirection: 'column' }}>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                    <Typography variant="h6">{UI_LABELS.VERSION_DETAILS}</Typography>
                    {selectedOperation && (
                        <Tooltip title="Clear selection">
                            <IconButton onClick={onClearSelection} size="small">
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>

                {!computeRevisionsResponse ? (
                    <Box display="flex" alignItems="center" justifyContent="center" minHeight={200} color="text.secondary">
                        <Typography>...</Typography>
                    </Box>
                ) : !selectedOperation ? (
                    <Box display="flex" alignItems="center" justifyContent="center" minHeight={200} color="text.secondary">
                        <Typography>Select a node in the graph to inspect its details.</Typography>
                    </Box>
                ) : (
                    <>
                        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                            <Typography variant="subtitle1">
                                Revision {selectedOperation.revision} — {selectedOperation.operationCode}
                            </Typography>
                            <Tooltip title="Cycle status">
                                <IconButton
                                    onClick={handleStatusCycle}
                                    size="small"
                                    sx={{ 
                                        color: getStatusColor(selectedOperation.status) 
                                            ? undefined 
                                            : 'text.secondary' 
                                    }}
                                >
                                    <FlagIcon
                                        color={getStatusColor(selectedOperation.status)}
                                        fontSize="medium"
                                    />
                                </IconButton>
                            </Tooltip>
                        </Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            {new Date(selectedOperation.timestamp).toLocaleString()} (via {selectedOperation.tool})
                        </Typography>

                        <Divider sx={{ my: 2 }} />

                        <Typography variant="subtitle2" gutterBottom>Operation Details</Typography>
                        <Box
                            sx={{
                                p: 1.5,
                                border: 1,
                                borderColor: 'grey.300',
                                borderRadius: 1,
                                bgcolor: 'grey.50',
                                maxHeight: 200,
                                overflow: 'auto',
                                mb: 2
                            }}
                        >
                            <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {(() => {
                                    const jsonStr = JSON.stringify(selectedOperation.operationDetails ?? {}, null, 2);
                                    // Remove leading and trailing curly brackets
                                    return jsonStr.replace(/^\{\s*\n?/, '').replace(/\n?\s*\}$/, '').trim();
                                })()}
                            </pre>
                        </Box>

                        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                            <Typography variant="subtitle2">Comments</Typography>
                            <Tooltip title="Add new comment">
                                <IconButton
                                    size="small"
                                    onClick={() => {
                                        setCommentText('');
                                        setCommentDialogOpen(true);
                                    }}
                                    sx={{
                                        color: 'success.main',
                                        '&:hover': {
                                            bgcolor: 'success.light',
                                            color: 'success.dark',
                                        },
                                    }}
                                >
                                    <AddIcon />
                                </IconButton>
                            </Tooltip>
                        </Box>
                        <Box
                            sx={{
                                p: 1.5,
                                border: 1,
                                borderColor: 'grey.300',
                                borderRadius: 1,
                                bgcolor: 'grey.50',
                                maxHeight: 200,
                                overflow: 'auto',
                                mb: 2
                            }}
                        >
                            {selectedOperation.comments && selectedOperation.comments.length > 0 ? (
                                <Stack spacing={1}>
                                    {[...selectedOperation.comments].reverse().map((comment, index) => {
                                        // Calculate original index for delete functionality (since we're reversing)
                                        const originalIndex = selectedOperation.comments!.length - 1 - index;
                                        return (
                                            <Box key={originalIndex}>
                                                <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={1}>
                                                    <Box flex={1}>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {new Date(comment.timestamp).toLocaleString()}
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                                                            {comment.text}
                                                        </Typography>
                                                    </Box>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => {
                                                            if (selectedRevisionKey) {
                                                                handleDeleteClick(selectedRevisionKey, originalIndex);
                                                            }
                                                        }}
                                                        sx={{ color: 'error.main', flexShrink: 0 }}
                                                    >
                                                        <ClearIcon fontSize="small" />
                                                    </IconButton>
                                                </Box>
                                                {index < selectedOperation.comments!.length - 1 && (
                                                    <Divider sx={{ my: 1 }} />
                                                )}
                                            </Box>
                                        );
                                    })}
                                </Stack>
                            ) : (
                                <Typography variant="body2" color="text.secondary">
                                    No comments
                                </Typography>
                            )}
                        </Box>

                        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                            <Box display="flex" alignItems="center" gap={1}>
                                <Tabs value={tabIndex} onChange={handleTabChange}>
                                    <Tab label="Design" />
                                    <Tooltip title="Difference between current and previous design">
                                        <Tab label="Diff" />
                                    </Tooltip>
                                </Tabs>
                                <Tooltip title="Copy sequence to clipboard">
                                    <IconButton
                                        size="small"
                                        onClick={handleCopySequence}
                                        disabled={!sequence}
                                        sx={{ 
                                            ml: 1, 
                                            color: 'text.secondary',
                                            '&:hover': {
                                                bgcolor: 'action.hover',
                                            }
                                        }}
                                    >
                                        <ContentCopyIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Download design file">
                                    <ButtonGroup 
                                        size="small" 
                                        variant="outlined" 
                                        sx={{ 
                                            ml: 0.5,
                                            '& .MuiButton-root': {
                                                borderColor: 'grey.300',
                                                color: 'text.secondary',
                                                '&:hover': {
                                                    borderColor: 'grey.400',
                                                    bgcolor: 'action.hover',
                                                },
                                                '&.Mui-disabled': {
                                                    borderColor: 'grey.200',
                                                }
                                            }
                                        }}
                                    >
                                        <Button
                                            onClick={handleDownloadMenuOpen}
                                            disabled={!selectedOperation}
                                            sx={{ 
                                                minWidth: 'auto',
                                                px: 1,
                                            }}
                                        >
                                            <FileDownloadIcon fontSize="small" />
                                            <ArrowDropDownIcon fontSize="small" />
                                        </Button>
                                    </ButtonGroup>
                                </Tooltip>
                                <Menu
                                    anchorEl={downloadMenuAnchor}
                                    open={Boolean(downloadMenuAnchor)}
                                    onClose={handleDownloadMenuClose}
                                >
                                    <MenuItem onClick={handleDownloadGenBank} disabled={!selectedOperation || (designFile ? isPDB(designFile.name) : isPDBContent(selectedOperation?.design))}>
                                        Download as GenBank
                                    </MenuItem>
                                    <MenuItem onClick={handleDownloadFASTA} disabled={!sequence || (designFile ? isPDB(designFile.name) : isPDBContent(selectedOperation?.design))}>
                                        Download as FASTA
                                    </MenuItem>
                                </Menu>
                                <Tooltip title={sequence ? "Run BLAST search on this sequence" : "No sequence available for BLAST search"}>
                                    <span>
                                        <Button
                                            disabled={!sequence || isBlastLoading}
                                            size="small"
                                            variant="outlined"
                                            sx={{ ml: 1 }}
                                            onClick={handleBlastSearch}
                                        >
                                            {isBlastLoading ? 'BLASTing...' : 'BLAST Version'}
                                        </Button>
                                    </span>
                                </Tooltip>
                                <Tooltip title={sequence ? "Run screening analysis on this version" : "No sequence available for screening"}>
                                    <span>
                                        <Button
                                            disabled={!sequence || isScreenLoading}
                                            size="small"
                                            variant="outlined"
                                            sx={{ ml: 1 }}
                                            onClick={handleScreenVersion}
                                            startIcon={isScreenLoading ? <CircularProgress size={16} /> : null}
                                        >
                                            {isScreenLoading ? 'Screening...' : 'Screen Version'}
                                        </Button>
                                    </span>
                                </Tooltip>
                            </Box>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={showLineNumbers}
                                        onChange={(event) => setShowLineNumbers(event.target.checked)}
                                    />
                                }
                                label="Line Numbers"
                            />
                        </Box>

                        {tabIndex === 0 && (
                            <Box mt={2}>
                                {sequence ? (
                                    isProtein ? (
                                        <Box
                                            sx={{
                                                width: '100%',
                                                maxHeight: 320,
                                                fontFamily: 'monospace',
                                                whiteSpace: 'pre-wrap',
                                                overflow: 'auto',
                                                p: 1,
                                                bgcolor: 'grey.50',
                                                borderRadius: 1,
                                                border: 1,
                                                borderColor: 'grey.200'
                                            }}
                                        >
                                            {sequence}
                                        </Box>
                                    ) : (
                                        <Box sx={{ height: 320 }}>
                                            <SeqViz
                                                style={{ width: '100%', height: '100%' }}
                                                seq={sequence}
                                                seqType="dna"
                                                annotations={annotations ?? []}
                                                viewer="linear"
                                            />
                                        </Box>
                                    )
                                ) : (
                                    <Box display="flex" alignItems="center" justifyContent="center" height={200}>
                                        <Typography color="text.secondary">No sequence available.</Typography>
                                    </Box>
                                )}
                            </Box>
                        )}

                        {tabIndex === 1 && (
                            <Box mt={2}>
                                {!previousOperation ? (
                                    <Box display="flex" alignItems="center" justifyContent="center" minHeight={200}>
                                        <Typography color="text.secondary">Initial design — nothing to diff.</Typography>
                                    </Box>
                                ) : previousOperation.design === selectedOperation.design ? (
                                    <Box display="flex" alignItems="center" justifyContent="center" minHeight={200}>
                                        <Typography color="text.secondary">No changes compared to previous revision.</Typography>
                                    </Box>
                                ) : (
                                    <ReactDiffViewer
                                        leftTitle={`Revision ${previousOperation.revision}`}
                                        rightTitle={`Revision ${selectedOperation.revision}`}
                                        oldValue={previousOperation.design}
                                        newValue={selectedOperation.design}
                                        splitView
                                        hideLineNumbers={!showLineNumbers}
                                        styles={{
                                            contentText: {
                                                fontSize: showLineNumbers ? '11px' : '13px',
                                            },
                                            diffContainer: {
                                                fontSize: showLineNumbers ? '11px' : '13px',
                                            },
                                        }}
                                    />
                                )}
                            </Box>
                        )}
                    </>
                )}
            </CardContent>
        </Card>

        {/* Comment Dialog */}
        <Dialog
            open={commentDialogOpen}
            onClose={() => setCommentDialogOpen(false)}
            maxWidth="sm"
            fullWidth
        >
            <DialogTitle>Add Comment</DialogTitle>
            <DialogContent>
                <TextField
                    autoFocus
                    margin="dense"
                    label="Comment"
                    fullWidth
                    multiline
                    rows={4}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    variant="outlined"
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setCommentDialogOpen(false)}>Cancel</Button>
                <Button
                    onClick={handleCommentSubmit}
                    variant="contained"
                    disabled={!commentText.trim()}
                >
                    Add
                </Button>
            </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
            open={deleteConfirmOpen}
            onClose={() => {
                setDeleteConfirmOpen(false);
                setCommentToDelete(null);
            }}
        >
            <DialogTitle>Delete Comment</DialogTitle>
            <DialogContent>
                <Typography>Are you sure you want to delete this comment?<br />This action cannot be undone.</Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => {
                    setDeleteConfirmOpen(false);
                    setCommentToDelete(null);
                }}>
                    Cancel
                </Button>
                <Button
                    onClick={handleDeleteConfirm}
                    variant="contained"
                    color="error"
                >
                    Delete
                </Button>
            </DialogActions>
        </Dialog>
    </>
    );
};

export default VersionDetailsPanel;

