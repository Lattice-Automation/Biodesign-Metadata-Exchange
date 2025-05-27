import React, { ChangeEvent, useEffect, useState } from 'react';
import { Box, Button, Typography, Card, CardContent, Select, MenuItem, FormControl, InputLabel, Tabs, Tab, IconButton, Stack, Tooltip, FormControlLabel, Switch } from '@mui/material';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { LoadingButton } from '@mui/lab';
import axios from 'axios';
import SeqViz from 'seqviz';
import seqparse, { parseFile } from "seqparse";
import ReactDiffViewer from 'react-diff-viewer-continued';

interface ComputeRevisionsResponse {
    error?: boolean;
    message?: string;
    id: string;
    parentMetadataId: string;
    designName: string;
    author: string;
    description: string;
    lastUpdated: string;
    revisions: Revision[];
}

interface BioDesignOperation {
    operationCode: string;
    operationDetails: Record<string, any>;
    change: string;
    tool: string
    timestamp: string;
}

interface Revision extends BioDesignOperation {
    revision: number;
    design: string;
}

const Admin: React.FC = () => {
    const [designFile, setDesignFile] = useState<File | null>(null);
    const [metadataFile, setMetadataFile] = useState<File | null>(null);
    const [computeRevisionsResponse, setComputeRevisionsResponse] = useState<ComputeRevisionsResponse | null>(null);
    const [selectedRevision, setSelectedRevision] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [tabIndex, setTabIndex] = useState<number>(0);
    const [sequence, setSequence] = useState<string | null>(null);
    const [annotations, setAnnotations] = useState<any[] | null>(null);
    const [showLineNumbers, setShowLineNumbers] = useState(false);
    const [isProtein, setIsProtein] = useState(false);

    useEffect(() => {
        const selectedOperation = computeRevisionsResponse?.revisions.find((r) => r.revision === selectedRevision);
        if (selectedOperation) {
            if (designFile?.name.endsWith(".gb")) {
                getSequenceAndAnnotations(selectedOperation);
                setIsProtein(false);
            } else {
                setSequence(selectedOperation.design);
                setAnnotations(null);
                setIsProtein(true);
            }
        }
    }, [computeRevisionsResponse, selectedRevision, designFile])

    const getSequenceAndAnnotations = async (selectedOperation: Revision) => {
        const seq = await parseFile(selectedOperation.design);
        setSequence(seq[0].seq);
        setAnnotations(seq[0].annotations);
    };

    const handleSelectDesign = (event: ChangeEvent<HTMLInputElement>): void => {
        const file = event.target.files?.[0];
        if (file) {
            setDesignFile(file);
        }
    };

    const handleSelectMetadata = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
        const file = event.target.files?.[0];
        if (file) {
            setMetadataFile(file);
        }
    };

    const handleGetRevisions = async () => {
        if (!designFile || !metadataFile) {
            toast.error('Please select both the design file and metadata file.');
            return;
        }

        setLoading(true);

        try {
            const body = { designFilePath: designFile.name, metadataFilePath: metadataFile.name };

            const response = await axios.post('http://localhost:8000/revisions', body);

            const computeRevisionsResponse: ComputeRevisionsResponse = response.data;
            if (computeRevisionsResponse.error) {
                toast.error(computeRevisionsResponse.message);
                return;
            }
            setComputeRevisionsResponse(computeRevisionsResponse);

            if (computeRevisionsResponse.revisions.length > 0) {
                setSelectedRevision(computeRevisionsResponse.revisions.length);
            } else {
                setSelectedRevision(null);
            }

            toast.success('Revisions fetched successfully.');
        } catch (error) {
            toast.error('Failed to fetch revisions from the server.');
        } finally {
            setLoading(false);
        }
    };

    const handleRevisionChange = (event: any) => {
        setSelectedRevision(event.target.value as number);
    };

    const selectedOperation = computeRevisionsResponse?.revisions.find((r) => r.revision === selectedRevision);

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabIndex(newValue);
    };

    const previousOperation = computeRevisionsResponse?.revisions.find((r) => r.revision === (selectedRevision ? selectedRevision - 1 : null));

    return (
        <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="top"
            bgcolor="#f0f4f7"
            minHeight="100vh"
            p={2}
        >
            <Card sx={{ maxWidth: 1350, width: '100%', p: 3 }}>
                <CardContent>
                    <Typography variant="h4" component="h1" gutterBottom align="center">
                        Review orders
                    </Typography>

                    <Typography variant="body1" align="center" color="textSecondary" paragraph>
                        Select (upload) a design and associated metadata file to review older versions of the design.
                    </Typography>

                    <Box display="flex" flexDirection="column" alignItems="center" gap={2} mt={3} width="50%" sx={{ margin: '0 auto' }}>
                        <Stack spacing={1} width="80%">
                            <Button
                                variant="outlined"
                                component="label"
                                color="primary"
                                fullWidth
                            >
                                Select the design (.gb / .pdb)
                                <input
                                    type="file"
                                    hidden
                                    onChange={handleSelectDesign}
                                />
                            </Button>
                            {designFile && (
                                <Box display="flex" alignItems="center" gap={1} bgcolor="rgba(0, 0, 0, 0.04)" p={1} borderRadius={1}>
                                    <Typography variant="body2" sx={{ flexGrow: 1 }} noWrap>
                                        {designFile.name}
                                    </Typography>
                                    <IconButton size="small" onClick={() => setDesignFile(null)} sx={{ minWidth: 32, width: 32, height: 32 }}>
                                        <Typography variant="body1">×</Typography>
                                    </IconButton>
                                </Box>
                            )}
                        </Stack>

                        <Stack spacing={1} width="80%">
                            <Button
                                variant="outlined"
                                component="label"
                                color="primary"
                                fullWidth
                            >
                                Select the metadata (.txt)
                                <input
                                    type="file"
                                    hidden
                                    onChange={handleSelectMetadata}
                                />
                            </Button>
                            {metadataFile && (
                                <Box display="flex" alignItems="center" gap={1} bgcolor="rgba(0, 0, 0, 0.04)" p={1} borderRadius={1}>
                                    <Typography variant="body2" sx={{ flexGrow: 1 }} noWrap>
                                        {metadataFile.name}
                                    </Typography>
                                    <IconButton size="small" onClick={() => setMetadataFile(null)} sx={{ minWidth: 32, width: 32, height: 32 }}>
                                        <Typography variant="body1">×</Typography>
                                    </IconButton>
                                </Box>
                            )}
                        </Stack>

                        <LoadingButton
                            onClick={handleGetRevisions}
                            loading={loading}
                            variant="contained"
                            color="primary"
                            sx={{ width: '80%' }}
                        >
                            Compute Revisions
                        </LoadingButton>
                    </Box>
                </CardContent>
            </Card>

            {computeRevisionsResponse && computeRevisionsResponse.revisions.length > 0 && (
                <Card sx={{ maxWidth: 1350, width: '100%', mt: 4, p: 3 }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                            Design metadata
                        </Typography>
                        <Box
                            my={2}
                            p={2}
                            border={1}
                            borderColor="grey.300"
                            borderRadius={1}
                        >
                            <Typography variant="subtitle1"><b>Id</b>: {computeRevisionsResponse.id}</Typography>
                            <Typography variant="subtitle1"><b>Parent Id:</b> {computeRevisionsResponse.parentMetadataId ? computeRevisionsResponse.parentMetadataId : "N/A"}</Typography>
                            <Typography variant="subtitle1"><b>Design name:</b> {computeRevisionsResponse.designName}</Typography>
                            <Typography variant="subtitle1"><b>Author:</b> {computeRevisionsResponse.author}</Typography>
                            <Typography variant="subtitle1"><b>Last updated:</b> {computeRevisionsResponse.lastUpdated}</Typography>
                        </Box>
                        <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                            Revisions
                        </Typography>
                        <Box display="flex" gap={2} alignItems="center">
                            <FormControl sx={{ flexGrow: 1 }}>
                                <InputLabel id="revision-select-label">Select Revision</InputLabel>
                                <Select
                                    labelId="revision-select-label"
                                    value={selectedRevision ?? ''}
                                    onChange={handleRevisionChange}
                                    label="Select Revision"
                                >
                                    {computeRevisionsResponse?.revisions.map((r) => (
                                        <MenuItem key={r.revision} value={r.revision}>
                                            Revision {r.revision} - {r.operationCode} - {new Date(r.timestamp).toLocaleString()}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            {selectedOperation?.tool && (
                                <Box
                                    p={2}
                                    border={1}
                                    borderColor="grey.300"
                                    borderRadius={1}
                                    sx={{ width: "50%" }}
                                >
                                    <Typography variant="subtitle1">Made in: <b>{selectedOperation.tool}</b></Typography>
                                </Box>
                            )}
                        </Box>
                        {selectedOperation?.operationDetails && (
                            <Box
                                mt={2}
                                p={2}
                                border={1}
                                borderColor="grey.300"
                                borderRadius={1}
                                maxHeight={300}
                                overflow="auto"
                            >
                                <Typography variant="subtitle1">Operation Details:</Typography>
                                <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                                    {JSON.stringify(selectedOperation.operationDetails, null, 2)}
                                </pre>
                            </Box>
                        )}
                        {selectedOperation && (
                            <Box sx={{ mt: 2 }}>
                                <Box display="flex" alignItems="center" gap={2}>
                                    <Tabs value={tabIndex} onChange={handleTabChange} centered>
                                        <Tab label="Design" />
                                        <Tooltip title="Difference between current and previous design">
                                            <Tab label="Diff" />
                                        </Tooltip>
                                    </Tabs>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={showLineNumbers}
                                                onChange={(e) => setShowLineNumbers(e.target.checked)}
                                            />
                                        }
                                        label="Line Numbers"
                                    />
                                </Box>

                                {tabIndex === 0 && (
                                    <Box mt={3}>
                                        {isProtein ? (
                                            <Box sx={{ 
                                                width: '100%',
                                                height: '500px', 
                                                fontFamily: 'monospace',
                                                whiteSpace: 'pre',
                                                overflow: 'auto',
                                                maxHeight: '500px'
                                            }}>
                                                {sequence}
                                            </Box>
                                        ) : (
                                            <SeqViz
                                                style={{ width: '100%', height: '500px' }}
                                                seq={sequence!}
                                                annotations={annotations!}
                                                viewer='linear'
                                            />
                                        )}
                                    </Box>
                                )}

                                {tabIndex === 1 && (
                                    <Box mt={3}>
                                        {!previousOperation ? (
                                            <Typography variant="body1" color="textSecondary" textAlign='center' sx={{ p: 3 }}>
                                                Initial design
                                            </Typography>
                                        ) : (
                                            previousOperation.design === selectedOperation.design ? (
                                                <Typography variant="body1" color="textSecondary" textAlign='center' sx={{ p: 3 }}>
                                                    No changes
                                                </Typography>
                                            ) :
                                                <ReactDiffViewer
                                                    leftTitle={previousOperation ? `Revision ${previousOperation.revision}` : ''}
                                                    rightTitle={`Revision ${selectedOperation.revision}`}
                                                    oldValue={previousOperation.design}
                                                    newValue={selectedOperation.design}
                                                    splitView={true}
                                                    hideLineNumbers={!showLineNumbers}
                                                />
                                        )}
                                    </Box>
                                )}
                            </Box>
                        )}
                    </CardContent>
                </Card>
            )}

            <ToastContainer position="bottom-center" autoClose={5000} theme="colored" style={{ width: "fit-content" }} />
        </Box>
    );
};

export default Admin;
