import React, { ChangeEvent, useState } from 'react';
import { Box, Button, Typography, Card, CardContent, IconButton, Stack } from '@mui/material';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { LoadingButton } from '@mui/lab';
import axios from 'axios';

const Home: React.FC = () => {
    const [designFile, setDesignFile] = useState<File | null>(null);
    const [metadataFile, setMetadataFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);

    const handleUploadDesign = (event: ChangeEvent<HTMLInputElement>): void => {
        const file = event.target.files?.[0];
        if (file) {
            setDesignFile(file);
        }
    };

    const handleUploadMetadata = (event: ChangeEvent<HTMLInputElement>): void => {
        const file = event.target.files?.[0];
        if (file) {
            setMetadataFile(file);
        }
    };

    const handleRemoveDesign = (): void => {
        setDesignFile(null);
    };

    const handleRemoveMetadata = (): void => {
        setMetadataFile(null);
    };

    const handleOrder = async (): Promise<void> => {
        if (!designFile) {
            toast.error("Please upload your design .gb file.");
            return;
        }

        if (!metadataFile) {
            setLoading(true);
            setTimeout(() => {
                setLoading(false);
                toast.error("We need more information to evaluate your design. Please upload it's BioDesign Metadata .txt file");
            }, 2000);
        } else {
            setLoading(true);
            try {
                const response = await axios.post('http://localhost:8000/order', {
                    designFilePath: designFile.name,
                    metadataFilePath: metadataFile.name,
                });

                const { error, message } = response.data;

                if (error) {
                    toast.error(message);
                } else {
                    toast.success(message);
                }
            } catch (err) {
                toast.error("An error occurred while placing the order.");
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            height="100vh"
            bgcolor="#f0f4f7"
            p={2}
        >
            <Card sx={{ maxWidth: 600, width: '100%', p: 5 }}>
                <CardContent>
                    <Typography variant="h4" component="h1" gutterBottom align="center">
                        Lattice Synthesis Provider
                    </Typography>

                    <Typography variant="body1" align="center" color="textSecondary" paragraph>
                        Welcome to the Lattice Synthesis Provider (demo) service. <br/>Please upload your design file and corresponding metadata. <br/>Once uploaded, proceed with validating the files.
                    </Typography>

                    <Box display="flex" flexDirection="column" alignItems="center" gap={2} mt={3}>
                        <Stack spacing={1} width="80%">
                            <Button
                                variant="outlined"
                                component="label"
                                color="primary"
                                fullWidth
                            >
                                GenBank Design File
                                <input
                                    type="file"
                                    hidden
                                    onChange={handleUploadDesign}
                                />
                            </Button>
                            {designFile && (
                                <Box display="flex" alignItems="center" gap={1} bgcolor="rgba(0, 0, 0, 0.04)" p={1} borderRadius={1}>
                                    <Typography variant="body2" sx={{ flexGrow: 1 }} noWrap>
                                        {designFile.name}
                                    </Typography>
                                    <IconButton size="small" onClick={handleRemoveDesign} sx={{ minWidth: 32, width: 32, height: 32 }}>
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
                                Corresponding Metadata Text File
                                <input
                                    type="file"
                                    hidden
                                    onChange={handleUploadMetadata}
                                />
                            </Button>
                            {metadataFile && (
                                <Box display="flex" alignItems="center" gap={1} bgcolor="rgba(0, 0, 0, 0.04)" p={1} borderRadius={1}>
                                    <Typography variant="body2" sx={{ flexGrow: 1 }} noWrap>
                                        {metadataFile.name}
                                    </Typography>
                                    <IconButton size="small" onClick={handleRemoveMetadata} sx={{ minWidth: 32, width: 32, height: 32 }}>
                                        <Typography variant="body1">×</Typography>
                                    </IconButton>
                                </Box>
                            )}
                        </Stack>

                        <LoadingButton
                            variant="contained"
                            color="success"
                            sx={{ width: '80%', mt: 2 }}
                            onClick={handleOrder}
                            loading={loading}
                        >
                            Validate and Place Order
                        </LoadingButton>
                    </Box>
                </CardContent>
            </Card>
            <ToastContainer position="bottom-center" autoClose={5000} theme="colored" style={{ width: "fit-content" }} />
        </Box>
    );
};

export default Home;
