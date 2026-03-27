import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Stack, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { toast } from 'react-toastify';
import { useBlocker } from 'react-router-dom';
import {
    Header,
    DesignOverviewCard,
    MetadataOverviewCard,
    VersionGraph,
    VersionDetailsPanel,
} from '../components';
import { useFileUpload, useRevisions } from '../hooks';
import {
    acceptsExtension,
    parseGenBankSummary,
    parsePDBSummary,
    parseFASTASummary,
    GenBankSummary,
    PDBSummary,
    FASTASummary,
    isGenBank,
    isPDB,
    isFASTA,
    ACCEPTED_EXTENSIONS,
    METADATA_EXTENSIONS,
    TOAST_MESSAGES,
    isZipFile,
    extractFilesFromZip,
    extractFilePairsFromZip,
    matchDesignToMetadataFiles,
    getEncryptionKey,
    zipContainsEncryptedMetadata,
    hasEncryptedMetadata,
    Revision,
    exportMetadataAndDesign,
    UnifiedGraph,
} from '../utils';
import { getStoredFiles, getStoredResults, clearStoredFiles, FilePair } from '../utils/fileStore';

const DesignGraph: React.FC = () => {
    const [designSummary, setDesignSummary] = useState<GenBankSummary | PDBSummary | FASTASummary | null>(null);
    const [selectedRevisionKey, setSelectedRevisionKey] = useState<string | null>(null); // Format: "${metadataId}-${revision}" or "${revision}" for single file
    // Track modifications to revisions (status and comments)
    const [modifiedRevisions, setModifiedRevisions] = useState<Map<number, Revision>>(new Map());
    // Confirmation dialog state
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
    // Navigation blocking state
    const [navigationDialogOpen, setNavigationDialogOpen] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

    // Block navigation if there are unsaved changes
    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            modifiedRevisions.size > 0 && currentLocation.pathname !== nextLocation.pathname
    );

    // Handle navigation blocking
    useEffect(() => {
        if (blocker.state === 'blocked') {
            setPendingNavigation(() => blocker.proceed);
            setNavigationDialogOpen(true);
        }
    }, [blocker]);

    // Handle browser navigation (refresh, close tab, etc.)
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (modifiedRevisions.size > 0) {
                e.preventDefault();
                e.returnValue = ''; // Required for Chrome
                return ''; // Required for Safari
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [modifiedRevisions.size]);

    const [storedResults, setStoredResults] = useState<import('../utils/resultsUtils').EvaluationResult | null>(() => getStoredResults());
    const [filePairs, setFilePairs] = useState<FilePair[]>(() => {
        if (getStoredResults()) return [];
        const stored = getStoredFiles();
        return stored && stored.length > 0 ? stored : [];
    });

    useEffect(() => {
        const results = getStoredResults();
        if (results) {
            setStoredResults(results);
            clearStoredFiles();
            return;
        }
        const stored = getStoredFiles();
        if (stored && stored.length > 0) {
            setFilePairs(stored);
            clearStoredFiles();
        }
    }, []);

    const firstPair = filePairs.length > 0 ? filePairs[0] : null;
    const { unifiedGraph, computeRevisionsResponse, evaluationResult, isFetching } = useRevisions({
        filePairs,
        storedResults,
    });

    // Helper to get unique key for a revision (handles overlapping revision numbers across files)
    const getRevisionKey = useCallback((rev: Revision) => {
        if (unifiedGraph) {
            const extendedRev = rev as any;
            return `${extendedRev.metadataId}-${rev.revision}`;
        }
        return rev.revision;
    }, [unifiedGraph]);

    const resetDerivedState = useCallback(() => {
        setSelectedRevisionKey(null);
        setModifiedRevisions(new Map());
    }, []);

    const processFiles = useCallback(async (files: File[]) => {
        if (!files.length) {
            return;
        }

        let newPairs: FilePair[] = [];

        // Check if any file is a zip file
        const zipFile = files.find(file => isZipFile(file));
        
        if (zipFile) {
            const needsKey = await zipContainsEncryptedMetadata(zipFile);
            const encryptionKey = needsKey ? getEncryptionKey() : undefined;
            if (needsKey && !encryptionKey) {
                toast.error(TOAST_MESSAGES.ENCRYPTION_KEY_MISSING);
                return;
            }
            try {
                newPairs = await extractFilePairsFromZip(zipFile, encryptionKey);
                
                if (newPairs.length === 0) {
                    toast.error('No matching design/metadata file pairs found in zip. Please ensure the zip contains matching design files (.gb, .gbk, .pdb, or .fasta) and metadata files (.txt or .json).');
                    return;
                }
            } catch (error: any) {
                toast.error(error.message || 'Failed to extract files from zip');
                return;
            }
        } else {
            // Handle individual files - separate design and metadata files
            const designFiles: File[] = [];
            const metadataFiles: File[] = [];
            
            files.forEach((file) => {
                const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

                if (!acceptsExtension(extension)) {
                    toast.error(TOAST_MESSAGES.UNSUPPORTED_FILE_TYPE(file.name));
                    return;
                }

                if (METADATA_EXTENSIONS.includes(extension as 'txt' | 'json')) {
                    metadataFiles.push(file);
                } else {
                    designFiles.push(file);
                }
            });
            
            const needsKey = hasEncryptedMetadata(metadataFiles);
            const encryptionKey = needsKey ? getEncryptionKey() : undefined;
            if (needsKey && !encryptionKey) {
                toast.error(TOAST_MESSAGES.ENCRYPTION_KEY_MISSING);
                return;
            }
            try {
                newPairs = await matchDesignToMetadataFiles(designFiles, metadataFiles, encryptionKey ?? '');
                
                if (newPairs.length === 0) {
                    toast.error('No matching design/metadata file pairs found. Please ensure metadata files contain a designName field that matches the design file names.');
                    return;
                }
            } catch (error: any) {
                toast.error(error.message || 'Failed to match design and metadata files');
                return;
            }
        }

        if (newPairs.length > 0) {
            resetDerivedState();
            setFilePairs(newPairs);
        }
    }, [resetDerivedState]);

    const handleFiles = useCallback(async (files: File[]) => {
        if (!files.length) {
            return;
        }

        // Check if there are any modifications that would be lost
        const hasModifications = modifiedRevisions.size > 0;

        if (hasModifications) {
            // Store pending files and show confirmation dialog
            setPendingFiles(files);
            setConfirmDialogOpen(true);
        } else {
            // No modifications, proceed directly
            await processFiles(files);
        }
    }, [modifiedRevisions.size, processFiles]);

    const handleConfirmReplace = useCallback(async () => {
        setConfirmDialogOpen(false);
        if (pendingFiles) {
            await processFiles(pendingFiles);
            setPendingFiles(null);
        }
    }, [pendingFiles, processFiles]);

    const handleCancelReplace = useCallback(() => {
        setConfirmDialogOpen(false);
        setPendingFiles(null);
    }, []);

    const handleConfirmNavigation = useCallback(() => {
        setNavigationDialogOpen(false);
        if (pendingNavigation) {
            pendingNavigation();
            setPendingNavigation(null);
        }
    }, [pendingNavigation]);

    const handleCancelNavigation = useCallback(() => {
        setNavigationDialogOpen(false);
        setPendingNavigation(null);
        // Reset the blocker if available
        if (blocker && 'reset' in blocker && typeof blocker.reset === 'function') {
            blocker.reset();
        }
    }, [blocker]);

    const {
        fileInputRef,
        isDragging,
        handleDrop,
        handleDragOver,
        handleDragLeave,
        handleFileDialogChange,
        handleZoneClick,
    } = useFileUpload({ onFiles: handleFiles });

    const clearFilePairs = useCallback(() => {
        setFilePairs([]);
        setStoredResults(null);
        setDesignSummary(null);
        resetDerivedState();
    }, [resetDerivedState]);

    // Merge original revisions with modifications
    // Use unifiedGraph if available (multi-file), otherwise fall back to computeRevisionsResponse (single file)
    const revisions = useMemo(() => {
        const baseRevisions = unifiedGraph?.revisions ?? computeRevisionsResponse?.revisions ?? [];
        // Sort revisions by revision number (ascending) - CREATE should be first
        const sorted = [...baseRevisions].sort((a, b) => a.revision - b.revision);
        
        if (modifiedRevisions.size === 0) {
            return sorted;
        }
        return sorted.map(rev => {
            // For unified graph, use metadataId-revision as key since revision numbers can overlap
            const key = unifiedGraph ? `${(rev as any).metadataId}-${rev.revision}` : rev.revision;
            const modified = modifiedRevisions.get(key as any);
            return modified ? { ...rev, ...modified } : rev;
        });
    }, [unifiedGraph, computeRevisionsResponse, modifiedRevisions]);


    // Set initial selected revision when revisions are loaded
    useEffect(() => {
        if ((unifiedGraph || computeRevisionsResponse) && revisions.length > 0 && selectedRevisionKey === null) {
            // Revisions are now sorted ascending (CREATE first), so use the last element for the latest revision
            const lastRevision = revisions[revisions.length - 1];
            const key = getRevisionKey(lastRevision);
            setSelectedRevisionKey(key.toString());
        } else if (!unifiedGraph && !computeRevisionsResponse && selectedRevisionKey !== null) {
            // Clear selected revision when revisions are cleared
            setSelectedRevisionKey(null);
        }
    }, [unifiedGraph, computeRevisionsResponse, revisions, selectedRevisionKey, getRevisionKey]);

    const selectedOperation = useMemo(() => {
        if (!selectedRevisionKey) return undefined;
        // Find revision by matching the key
        return revisions.find((r) => getRevisionKey(r).toString() === selectedRevisionKey);
    }, [revisions, selectedRevisionKey, getRevisionKey]);

    const previousOperation = useMemo(() => {
        if (!selectedOperation) return undefined;
        const rev = selectedOperation as any;
        const currentMetadataId = unifiedGraph ? rev.metadataId : null;
        const currentRevision = rev.revision;
        const priorRevision = currentRevision - 1;
        // Find the previous revision in the same metadata file
        return revisions.find((r) => {
            const rRev = r as any;
            return (unifiedGraph ? rRev.metadataId === currentMetadataId : true) && r.revision === priorRevision;
        });
    }, [revisions, selectedOperation, unifiedGraph]);

    // Get file pair for selected operation (or fall back to first pair)
    const selectedFilePair = useMemo(() => {
        if (selectedOperation && unifiedGraph) {
            const extendedRev = selectedOperation as any;
            const metadataData = unifiedGraph.metadataMap.get(extendedRev.metadataId);
            if (metadataData) {
                return metadataData.filePair;
            }
        }
        return firstPair;
    }, [selectedOperation, unifiedGraph, firstPair]);

    // Set design summary from the selected operation's design file (or first pair if no selection)
    useEffect(() => {
        const designFile = selectedFilePair?.designFile || null;
        if (!designFile) {
            setDesignSummary(null);
            return;
        }

        let cancelled = false;

        const readSummary = async () => {
            try {
                const text = await designFile.text();
                if (!cancelled) {
                    // Parse based on file type
                    if (isGenBank(designFile.name)) {
                        setDesignSummary(parseGenBankSummary(text));
                    } else if (isPDB(designFile.name)) {
                        setDesignSummary(parsePDBSummary(text));
                    } else if (isFASTA(designFile.name)) {
                        setDesignSummary(parseFASTASummary(text));
                    } else {
                        setDesignSummary(null);
                    }
                }
            } catch (error) {
                if (!cancelled) {
                    toast.error(TOAST_MESSAGES.UNABLE_TO_READ_GENBANK);
                    setDesignSummary(null);
                }
            }
        };

        readSummary();

        return () => {
            cancelled = true;
        };
    }, [selectedFilePair?.designFile]);

    const handleNodeClick = useCallback((revisionKey: string) => {
        setSelectedRevisionKey(revisionKey);
    }, []);

    // Update revision status
    const handleStatusUpdate = useCallback((revisionKey: string | number, status: string) => {
        setModifiedRevisions(prev => {
            const newMap = new Map(prev);
            // Find revision by matching the key
            const currentRev = revisions.find(r => getRevisionKey(r).toString() === revisionKey.toString());
            if (currentRev) {
                const key = getRevisionKey(currentRev);
                newMap.set(key as any, { ...currentRev, status });
            }
            return newMap;
        });
    }, [revisions, getRevisionKey]);

    // Add comment to revision
    const handleCommentAdd = useCallback((revisionKey: string | number, commentText: string) => {
        setModifiedRevisions(prev => {
            const newMap = new Map(prev);
            // Find revision by matching the key
            const currentRev = revisions.find(r => getRevisionKey(r).toString() === revisionKey.toString());
            if (currentRev) {
                const key = getRevisionKey(currentRev);
                const comments = currentRev.comments || [];
                const newComment = {
                    timestamp: new Date().toISOString(),
                    text: commentText,
                };
                newMap.set(key as any, {
                    ...currentRev,
                    comments: [...comments, newComment],
                });
            }
            return newMap;
        });
    }, [revisions, getRevisionKey]);

    // Delete comment from revision
    const handleCommentDelete = useCallback((revisionKey: string | number, commentIndex: number) => {
        setModifiedRevisions(prev => {
            const newMap = new Map(prev);
            // Find revision by matching the key
            const currentRev = revisions.find(r => getRevisionKey(r).toString() === revisionKey.toString());
            if (currentRev) {
                const key = getRevisionKey(currentRev);
                const comments = currentRev.comments || [];
                const newComments = comments.filter((_, idx) => idx !== commentIndex);
                newMap.set(key as any, {
                    ...currentRev,
                    comments: newComments,
                });
            }
            return newMap;
        });
    }, [revisions, getRevisionKey]);

    return (
        <Box
            display="flex"
            flexDirection="column"
            bgcolor="#f0f4f7"
            minHeight="100vh"
            p={2}
        >
            <Box sx={{ width: '100%', maxWidth: 1400, margin: '0 auto' }}>
                <Stack spacing={3}>
                    <Header title="Biodesign Metadata Interpretation Tool" />

                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
                        <DesignOverviewCard
                            designFile={selectedFilePair?.designFile || null}
                            designSummary={designSummary}
                            onClear={clearFilePairs}
                            onClick={handleZoneClick}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            isDragging={isDragging}
                        />

                        <MetadataOverviewCard
                            metadataFile={selectedFilePair?.metadataFile || null}
                            computeRevisionsResponse={computeRevisionsResponse}
                            unifiedGraph={unifiedGraph}
                            selectedOperation={selectedOperation}
                            evaluationResult={evaluationResult}
                            isFetching={isFetching}
                            onClear={clearFilePairs}
                            onClick={handleZoneClick}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            isDragging={isDragging}
                        />
                    </Stack>

                    <input
                        ref={fileInputRef}
                        type="file"
                        hidden
                        multiple
                        accept={`${ACCEPTED_EXTENSIONS},.zip`}
                        onChange={handleFileDialogChange}
                    />

                    <VersionGraph
                        revisions={revisions}
                        unifiedGraph={unifiedGraph}
                        computeRevisionsResponse={computeRevisionsResponse}
                        designFile={selectedFilePair?.designFile || (filePairs.length > 0 ? filePairs[0]?.designFile : null) || null}
                        metadataFile={selectedFilePair?.metadataFile || (filePairs.length > 0 ? filePairs[0]?.metadataFile : null) || null}
                        isFetching={isFetching}
                        selectedRevisionKey={selectedRevisionKey}
                        onNodeClick={handleNodeClick}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        isDragging={isDragging}
                        onExport={async () => {
                            const exportFilePair = selectedFilePair || firstPair;
                            if (!exportFilePair?.designFile || !computeRevisionsResponse || revisions.length === 0) {
                                toast.error('Cannot export: missing required files or data.');
                                return;
                            }
                            try {
                                const designContent = await exportFilePair.designFile.text();
                                await exportMetadataAndDesign(
                                    revisions,
                                    computeRevisionsResponse,
                                    exportFilePair.designFile,
                                    designContent
                                );
                            } catch (error: any) {
                                console.error('Export error:', error);
                                toast.error(error.message || 'Failed to export files.');
                            }
                        }}
                    />

                    <VersionDetailsPanel
                        computeRevisionsResponse={computeRevisionsResponse}
                        selectedOperation={selectedOperation}
                        previousOperation={previousOperation}
                        designFile={selectedFilePair?.designFile || null}
                        selectedRevisionKey={selectedRevisionKey}
                        onClearSelection={() => setSelectedRevisionKey(null)}
                        onStatusUpdate={handleStatusUpdate}
                        onCommentAdd={handleCommentAdd}
                        onCommentDelete={handleCommentDelete}
                    />
                </Stack>
            </Box>

            <ToastContainer position="bottom-center" autoClose={5000} theme="colored" style={{ width: 'fit-content' }} />

            {/* Confirmation dialog for replacing files */}
            <Dialog
                open={confirmDialogOpen}
                onClose={handleCancelReplace}
                aria-labelledby="confirm-dialog-title"
                aria-describedby="confirm-dialog-description"
            >
                <DialogTitle id="confirm-dialog-title">
                    Replace Files?
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="confirm-dialog-description">
                        You have unsaved changes (status flags and/or comments) that will be lost if you replace the files. Are you sure you want to continue?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCancelReplace} color="primary">
                        Cancel
                    </Button>
                    <Button onClick={handleConfirmReplace} color="error" variant="contained" autoFocus>
                        Replace Files
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Confirmation dialog for navigation */}
            <Dialog
                open={navigationDialogOpen}
                onClose={handleCancelNavigation}
                aria-labelledby="navigation-dialog-title"
                aria-describedby="navigation-dialog-description"
            >
                <DialogTitle id="navigation-dialog-title">
                    Leave Page?
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="navigation-dialog-description">
                        You have unsaved changes (status flags and/or comments) that will be lost if you leave this page. Are you sure you want to continue?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCancelNavigation} color="primary">
                        Stay on Page
                    </Button>
                    <Button onClick={handleConfirmNavigation} color="error" variant="contained" autoFocus>
                        Leave Page
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default DesignGraph;
