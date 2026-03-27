import React from 'react';
import { Box, Card, CardContent, Typography, Divider, Tooltip } from '@mui/material';
import { Link } from 'react-router-dom';
import GitHubIcon from '@mui/icons-material/GitHub';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import SettingsIcon from '@mui/icons-material/Settings';

interface HeaderProps {
    title: string;
}

const Header: React.FC<HeaderProps> = ({ title }) => {
    return (
        <Card 
            elevation={2}
            sx={{ 
                width: '100%', 
                '&:hover': {
                    boxShadow: 4,
                },
            }}
        >
            <CardContent sx={{ py: '16px !important' }}>
                <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                    {/* Left side: Logos with divider, linking to homepage */}
                    <Box display="flex" alignItems="center" gap={2} component={Link} to="/" sx={{ textDecoration: 'none', color: 'inherit' }}>
                        <Box
                            component="img"
                            src="/NTIbio.png"
                            alt="NTI | bio"
                            sx={{
                                height: 30,
                                maxWidth: 150,
                                objectFit: 'contain',
                            }}
                        />
                        <Divider orientation="vertical" flexItem sx={{ height: 40 }} />
                        <Box
                            component="img"
                            src="/Lattice.png"
                            alt="Lattice"
                            sx={{
                                height: 40,
                                maxWidth: 150,
                                objectFit: 'contain',
                            }}
                        />
                    </Box>

                    {/* Center: Title */}
                    <Box component={Link} to="/" display="flex" alignItems="center" justifyContent="center" sx={{ textDecoration: 'none', color: 'inherit' }}>
                        <Typography variant="h5" component="h1" sx={{ fontWeight: 500 }}>
                            {title}
                        </Typography>
                    </Box>

                    {/* Right side: Icon links */}
                    <Box display="flex" alignItems="center" gap={2}>
                        <Tooltip title="Nuclear Threat Initiative | White Paper">
                            <Box
                                component="a"
                                href="https://www.nti.org/analysis/articles/white-paper-a-proposal-for-biodesign-metadata-exchange-for-use-in-biosecurity/"
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    textDecoration: 'none',
                                    cursor: 'pointer',
                                    '&:hover': {
                                        opacity: 0.8,
                                    },
                                }}
                            >
                                <Box
                                    component="img"
                                    src="/nti-logo.png"
                                    alt="NTI"
                                    sx={{
                                        height: 35,
                                        maxWidth: 100,
                                        objectFit: 'contain',
                                    }}
                                />
                            </Box>
                        </Tooltip>
                        <Tooltip title="Lattice Automation">
                            <Box
                                component="a"
                                href="https://latticeautomation.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    textDecoration: 'none',
                                    cursor: 'pointer',
                                    '&:hover': {
                                        opacity: 0.8,
                                    },
                                }}
                            >
                                <Box
                                    component="img"
                                    src="/lattice-circle-logo.png"
                                    alt="Lattice"
                                    sx={{
                                        height: 35,
                                        maxWidth: 100,
                                        objectFit: 'contain',
                                    }}
                                />
                            </Box>
                        </Tooltip>
                        <Tooltip title="GitHub Repository">
                            <Box
                                component="a"
                                href="https://github.com/Lattice-Automation/Biodesign-Metadata-Exchange"
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    textDecoration: 'none',
                                    cursor: 'pointer',
                                    color: 'text.primary',
                                    '&:hover': {
                                        opacity: 0.8,
                                    },
                                }}
                            >
                                <GitHubIcon sx={{ height: 35, width: 35 }} />
                            </Box>
                        </Tooltip>
                        <Tooltip title="Documentation">
                            <Box
                                component="a"
                                href="https://nti-metadata-guides.s3.us-east-1.amazonaws.com/Interpreter-Tool.pdf"
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    textDecoration: 'none',
                                    cursor: 'pointer',
                                    color: 'darkred',
                                    '&:hover': {
                                        opacity: 0.8,
                                    },
                                }}
                            >
                                <PictureAsPdfIcon sx={{ height: 35, width: 35 }} />
                            </Box>
                        </Tooltip>
                        <Tooltip title="Settings">
                            <Box
                                component={Link}
                                to="/settings"
                                sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    textDecoration: 'none',
                                    cursor: 'pointer',
                                    color: 'text.primary',
                                    '&:hover': {
                                        opacity: 0.8,
                                    },
                                }}
                            >
                                <SettingsIcon sx={{ height: 35, width: 35 }} />
                            </Box>
                        </Tooltip>
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
};

export default Header;

