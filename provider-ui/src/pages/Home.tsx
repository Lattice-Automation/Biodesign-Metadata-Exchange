import React, { useCallback, useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, Select, MenuItem, FormControl, InputLabel, Button, Stack, Dialog, DialogTitle, DialogContent, DialogActions, Divider, Chip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { toast } from 'react-toastify';
import { Header, FileUploadZone } from '../components';
import { useFileUpload } from '../hooks';
import { acceptsExtension, METADATA_EXTENSIONS, TOAST_MESSAGES, loadSamples, downloadSampleFiles, loadSampleFiles, type SampleFilePair, isZipFile, extractFilePairsFromZip, extractResultsFromZip, matchDesignToMetadataFiles, getEncryptionKey, isResultsFile, parseResultsFile, zipContainsEncryptedMetadata, hasEncryptedMetadata } from '../utils';
import { setStoredFiles, setStoredResults } from '../utils/fileStore';
import { buildUnifiedGraph } from '../utils/graphConstruction';
import { applyRulesToRevisions } from '../utils/ruleChecker';
import { loadSettings } from '../utils/settings';

const Home: React.FC = () => {
    const navigate = useNavigate();
    const [samples, setSamples] = useState<SampleFilePair[]>([]);
    const [selectedSample, setSelectedSample] = useState<string>('');
    const [isLoadingSamples, setIsLoadingSamples] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
    const [summaryData, setSummaryData] = useState<{
        designName: string;
        author: string;
        totalRevisions: number;
        operationTypes: Record<string, number>;
        flaggedRevisions: number;
        appliedRules: Array<{ name: string; flaggedCount: number }>;
        dateRange: { earliest: string; latest: string } | null;
        aiRevisionsDetected: number;
        failedAutomatedScreenings: number;
    } | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);

    // Load available samples on mount
    useEffect(() => {
        const fetchSamples = async () => {
            setIsLoadingSamples(true);
            try {
                const loadedSamples = await loadSamples();
                setSamples(loadedSamples);
            } catch (error) {
                console.error('Failed to load samples:', error);
            } finally {
                setIsLoadingSamples(false);
            }
        };
        fetchSamples();
    }, []);

    const handleFiles = useCallback(async (files: File[]) => {
        if (!files.length) return;

        // Check for results.json first (takes precedence, no encryption needed)
        const resultsFile = files.find(f => isResultsFile(f));
        if (resultsFile) {
            try {
                const result = await parseResultsFile(resultsFile);
                if (!result.success || !result.revisions?.length) {
                    toast.error(result.error || 'Invalid results file: no revisions found');
                    return;
                }
                setStoredResults(result);
                navigate('/design-graph');
                toast.success(`Loaded results: ${result.revisions.length} revisions`);
                return;
            } catch (error: any) {
                toast.error(error.message || 'Failed to parse results file');
                return;
            }
        }

        // Check if any file is a zip file
        const zipFile = files.find(file => isZipFile(file));
        if (zipFile) {
            try {
                const zipResults = await extractResultsFromZip(zipFile);
                if (zipResults) {
                    setStoredResults(zipResults);
                    navigate('/design-graph');
                    toast.success(`Loaded results from zip: ${zipResults.revisions.length} revisions`);
                    return;
                }
            } catch (error: any) {
                console.warn('Could not extract results from zip:', error);
            }
            const needsKey = await zipContainsEncryptedMetadata(zipFile);
            const encryptionKey = needsKey ? getEncryptionKey() : '';
            if (needsKey && !encryptionKey) {
                toast.error(TOAST_MESSAGES.ENCRYPTION_KEY_MISSING);
                return;
            }
            try {
                const pairs = await extractFilePairsFromZip(zipFile, encryptionKey || undefined);
                if (pairs.length === 0) {
                    toast.error('No matching design/metadata file pairs found in zip.');
                    return;
                }
                setStoredFiles(pairs);
                navigate('/design-graph');
            } catch (error: any) {
                toast.error(error.message || 'Failed to extract files from zip');
            }
            return;
        }

        // Individual files - only require encryption key for .txt (encrypted) metadata
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
        const encryptionKey = needsKey ? getEncryptionKey() : '';
        if (needsKey && !encryptionKey) {
            toast.error(TOAST_MESSAGES.ENCRYPTION_KEY_MISSING);
            return;
        }
        try {
            const pairs = await matchDesignToMetadataFiles(designFiles, metadataFiles, encryptionKey);
            if (pairs.length === 0) {
                toast.error('No matching design/metadata file pairs found.');
                return;
            }
            setStoredFiles(pairs);
            navigate('/design-graph');
        } catch (error: any) {
            toast.error(error.message || 'Failed to match design and metadata files');
        }
    }, [navigate]);

    const {
        fileInputRef,
        isDragging,
        handleDrop,
        handleDragOver,
        handleDragLeave,
        handleFileDialogChange,
        handleZoneClick,
    } = useFileUpload({ onFiles: handleFiles });

    const handleDownload = useCallback(async () => {
        if (!selectedSample) {
            toast.error('Please select a sample first');
            return;
        }

        const sample = samples.find(s => s.id === selectedSample);
        if (!sample) {
            toast.error('Selected sample not found');
            return;
        }

        setIsDownloading(true);
        try {
            await downloadSampleFiles(sample);
            toast.success('Sample files downloaded successfully');
        } catch (error: any) {
            toast.error(error.message || 'Failed to download sample files');
        } finally {
            setIsDownloading(false);
        }
    }, [selectedSample, samples]);

    const handleParse = useCallback(async () => {
        if (!selectedSample) {
            toast.error('Please select a sample first');
            return;
        }

        const sample = samples.find(s => s.id === selectedSample);
        if (!sample) {
            toast.error('Selected sample not found');
            return;
        }

        setIsParsing(true);
        try {
            const filePairs = await loadSampleFiles(sample);
            // loadSampleFiles now returns FilePair[] directly (extracted from zip)
            if (filePairs.length > 0) {
                setStoredFiles(filePairs);
                navigate('/design-graph');
            } else {
                toast.error('No file pairs found in sample zip file');
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to load sample files');
        } finally {
            setIsParsing(false);
        }
    }, [selectedSample, samples, navigate]);

    const handleSummarize = useCallback(async () => {
        if (!selectedSample) {
            toast.error('Please select a sample first');
            return;
        }

        const sample = samples.find(s => s.id === selectedSample);
        if (!sample) {
            toast.error('Selected sample not found');
            return;
        }

        setIsSummarizing(true);
        try {
            const filePairs = await loadSampleFiles(sample);
            if (filePairs.length === 0) {
                toast.error('No file pairs found in sample zip file');
                return;
            }

            const needsKey = hasEncryptedMetadata(filePairs.map((p) => p.metadataFile));
            const encryptionKey = needsKey ? getEncryptionKey() : undefined;
            if (needsKey && !encryptionKey) {
                toast.error(TOAST_MESSAGES.ENCRYPTION_KEY_MISSING);
                return;
            }

            // Build unified graph to get all revisions
            const unifiedGraph = await buildUnifiedGraph(filePairs, encryptionKey);
            
            // Reset yellow statuses on revisions to ensure fresh rule application for tracking
            // (rules only apply to revisions without existing status, so we need to reset yellow
            // statuses that were set during initial parsing to track which rule matched)
            const revisionsForRuleCheck = unifiedGraph.revisions.map(rev => ({
                ...rev,
                status: rev.status === 'yellow' ? '' : (rev.status || ''), // Reset yellow, keep red/green
            }));
            
            // Apply rules to revisions and get statistics
            const { revisions: revisionsWithRules, ruleStats } = applyRulesToRevisions(revisionsForRuleCheck);
            
            // Count operation types
            const operationTypes: Record<string, number> = {};
            revisionsWithRules.forEach(rev => {
                operationTypes[rev.operationCode] = (operationTypes[rev.operationCode] || 0) + 1;
            });

            const FLAGGED_STATUSES = ['flagged', 'screening_failed', 'marked_unsafe', 'yellow', 'red'];
            const flaggedRevisions = revisionsWithRules.filter(rev => FLAGGED_STATUSES.includes(rev.status || '')).length;

            const autoScreenedRevisions = revisionsWithRules.filter(rev =>
                rev.status === 'screening_failed' || rev.status === 'red'
            ).length;

            // Calculate date range
            let dateRange: { earliest: string; latest: string } | null = null;
            if (revisionsWithRules.length > 0) {
                const timestamps = revisionsWithRules.map(rev => rev.timestamp).filter(ts => ts);
                if (timestamps.length > 0) {
                    const sortedTimestamps = [...timestamps].sort((a, b) => 
                        new Date(a).getTime() - new Date(b).getTime()
                    );
                    dateRange = {
                        earliest: sortedTimestamps[0],
                        latest: sortedTimestamps[sortedTimestamps.length - 1],
                    };
                }
            }

            // Get applied rules info with accurate counts
            const settings = loadSettings();
            const enabledRules = settings.autoHighlightRules.filter(rule => rule.enabled);
            
            // Debug: log rule stats to see what we have
            console.log('Rule Stats Map:', Array.from(ruleStats.entries()));
            console.log('Enabled Rules:', enabledRules.map(r => ({ id: r.id, name: r.name })));
            
            const appliedRules = enabledRules.map(rule => ({
                name: rule.name,
                flaggedCount: ruleStats.get(rule.id) || 0,
            }));

            // Count AI revisions detected (revisions flagged by suspected AI operations rule)
            const suspectedAIRuleId = 'suspected-ai-operations';
            const aiRevisionsDetected = ruleStats.get(suspectedAIRuleId) || 0;

            // Get metadata from first file pair
            const firstMetadata = unifiedGraph.metadataMap.values().next().value;
            const metadata = firstMetadata?.metadata;

            setSummaryData({
                designName: metadata?.designName || filePairs[0]?.designName || 'Unknown',
                author: metadata?.author || 'Unknown',
                totalRevisions: revisionsWithRules.length,
                operationTypes,
                flaggedRevisions,
                appliedRules: enabledRules.length > 0 ? appliedRules : [],
                dateRange,
                aiRevisionsDetected,
                failedAutomatedScreenings: autoScreenedRevisions, // Count of auto-screened revisions
            });

            setSummaryDialogOpen(true);
        } catch (error: any) {
            toast.error(error.message || 'Failed to generate summary');
        } finally {
            setIsSummarizing(false);
        }
    }, [selectedSample, samples]);

    return (
        <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="flex-start"
            minHeight="100vh"
            bgcolor="#f0f4f7"
            p={2}
        >
            <Box sx={{ width: '100%', maxWidth: 1400, margin: '0 auto', mb: 3 }}>
                <Header title="Biodesign Metadata Interpretation Tool" />
            </Box>

            <FileUploadZone
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                isDragging={isDragging}
                sx={{ width: '100%', maxWidth: 1400 }}
            >
                <Card
                    onClick={handleZoneClick}
                    sx={{
                        width: '100%',
                        minHeight: 400,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                            boxShadow: 6,
                        },
                    }}
                >
                    <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 4 }}>
                        {/* Drag and Drop Section */}
                        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography variant="h5" component="h2" gutterBottom align="center" color="text.primary">
                                Inspect the metadata and history of your biodesign files
                            </Typography>
                            <Typography variant="h5" align="center" color="text.primary" sx={{ mb: 2 }}>
                                Drop your files here (or click to browse)
                            </Typography>
                            <Typography variant="body1" align="center" color="text.secondary" sx={{ mt: 2, mb: 2 }}>
                                This tool will parse one or more biodesign metadata files and display the design history graph.
                            </Typography>
                            <Typography variant="body1" align="center" color="text.secondary" sx={{ mt: 2, mb: 4 }}>
                                Include design file(s) (.gb, .gbk, .pdb, .fasta) and metadata file(s) (.txt or .json), a results.json file, or a zip containing them.
                            </Typography>

                            {/* Sample Files Section */}
                            <Box 
                                sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Typography variant="body1" align="center" color="text.secondary">
                                    Or you can download/test the following sample files:
                                </Typography>
                                <FormControl sx={{ minWidth: 250 }} size="small">
                                    <InputLabel id="sample-select-label">Select Example</InputLabel>
                                    <Select
                                        labelId="sample-select-label"
                                        id="sample-select"
                                        value={selectedSample}
                                        label="Select Example"
                                        onChange={(e) => setSelectedSample(e.target.value)}
                                        disabled={isLoadingSamples || samples.length === 0}
                                    >
                                        {samples.map((sample) => (
                                            <MenuItem key={sample.id} value={sample.id}>
                                                {sample.name} {sample.description && `- ${sample.description}`}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <Stack direction="row" spacing={2} alignItems="center">
                                    <Button
                                        variant="outlined"
                                        onClick={handleDownload}
                                        disabled={!selectedSample || isDownloading || isParsing || isSummarizing}
                                    >
                                        {isDownloading ? 'Downloading...' : 'Download'}
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        onClick={handleSummarize}
                                        disabled={!selectedSample || isDownloading || isParsing || isSummarizing}
                                    >
                                        {isSummarizing ? 'Summarizing...' : 'Summarize'}
                                    </Button>
                                    <Button
                                        variant="contained"
                                        onClick={handleParse}
                                        disabled={!selectedSample || isDownloading || isParsing || isSummarizing}
                                    >
                                        {isParsing ? 'Loading...' : 'Parse'}
                                    </Button>
                                </Stack>
                            </Box>
                        </Box>
                    </CardContent>
                </Card>
            </FileUploadZone>

            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".gb,.gbk,.pdb,.fasta,.fa,.faa,.fna,.txt,.json,.zip"
                style={{ display: 'none' }}
                onChange={handleFileDialogChange}
            />

            <ToastContainer position="bottom-center" autoClose={5000} theme="colored" style={{ width: 'fit-content' }} />

            {/* Summary Dialog */}
            <Dialog
                open={summaryDialogOpen}
                onClose={() => setSummaryDialogOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogContent>
                    {summaryData ? (
                        <Stack spacing={3}>
                            {/* Basic Information */}
                            <Box>
                                <Typography variant="h6" gutterBottom>
                                    General Info
                                </Typography>
                                <Stack spacing={1}>
                                    <Box display="flex" justifyContent="space-between">
                                        <Typography variant="body2" color="text.secondary">Author:</Typography>
                                        <Typography variant="body2" fontWeight={500}>{summaryData.author}</Typography>
                                    </Box>
                                    {summaryData.dateRange && (
                                        <Box display="flex" justifyContent="space-between">
                                            <Typography variant="body2" color="text.secondary">Date Range:</Typography>
                                            <Typography variant="body2" fontWeight={500}>
                                                {new Date(summaryData.dateRange.earliest).toLocaleDateString()} - {new Date(summaryData.dateRange.latest).toLocaleDateString()}
                                            </Typography>
                                        </Box>
                                    )}
                                    <Box display="flex" justifyContent="space-between">
                                        <Typography variant="body2" color="text.secondary">Total Revisions:</Typography>
                                        <Typography variant="body2" fontWeight={500}>{summaryData.totalRevisions}</Typography>
                                    </Box>
                                    <Box display="flex" justifyContent="space-between">
                                        <Typography variant="body2" color="text.secondary">Flagged Revisions:</Typography>
                                        <Typography variant="body2" fontWeight={500}>{summaryData.flaggedRevisions}</Typography>
                                    </Box>
                                    <Box display="flex" justifyContent="space-between">
                                        <Typography variant="body2" color="text.secondary">AI Revisions Detected:</Typography>
                                        <Typography variant="body2" fontWeight={500}>{summaryData.aiRevisionsDetected}</Typography>
                                    </Box>
                                    <Box display="flex" justifyContent="space-between">
                                        <Typography variant="body2" color="text.secondary">Failed Automated Screenings:</Typography>
                                        <Typography variant="body2" fontWeight={500}>{summaryData.failedAutomatedScreenings}</Typography>
                                    </Box>
                                </Stack>
                            </Box>

                            <Divider />

                            {/* Operation Types */}
                            <Box>
                                <Typography variant="h6" gutterBottom>
                                    Operation Types
                                </Typography>
                                <Box display="flex" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
                                    {Object.entries(summaryData.operationTypes).map(([opType, count]) => (
                                        <Chip
                                            key={opType}
                                            label={`${opType}: ${count}`}
                                            size="small"
                                            variant="outlined"
                                        />
                                    ))}
                                </Box>
                            </Box>

                            <Divider />

                            {/* Applied Rules */}
                            {summaryData.appliedRules.length > 0 ? (
                                <Box>
                                    <Typography variant="h6" gutterBottom>
                                        Applied Rules
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                        {summaryData.flaggedRevisions} revision(s) flagged by automated rules
                                    </Typography>
                                    <Stack spacing={1}>
                                        {summaryData.appliedRules.map((rule, index) => (
                                            <Box key={index} sx={{ p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                                                <Typography variant="body2" fontWeight={500}>
                                                    {rule.name}: <b>{rule.flaggedCount}</b> revision(s) flagged
                                                </Typography>
                                            </Box>
                                        ))}
                                    </Stack>
                                </Box>
                            ) : (
                                <Box>
                                    <Typography variant="h6" gutterBottom>
                                        Automated Rules
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        No rules are currently enabled. Enable rules in Settings to automatically flag revisions.
                                    </Typography>
                                </Box>
                            )}
                        </Stack>
                    ) : (
                        <Typography>Loading summary...</Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSummaryDialogOpen(false)}>Close</Button>
                    <Button
                        variant="contained"
                        onClick={() => {
                            setSummaryDialogOpen(false);
                            if (selectedSample) {
                                handleParse();
                            }
                        }}
                    >
                        View Full Graph
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Home;

