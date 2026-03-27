import React from 'react';
import { Box, Typography } from '@mui/material';
import FlagIcon from '@mui/icons-material/Flag';
import { Handle, Position, type NodeProps } from 'reactflow';
import { getStatusColor } from '../utils/resultsUtils';

export interface RevisionNodeData {
    revision: number;
    operationCode: string;
    timestamp: string;
    status?: string;
    designName?: string;
}

const RevisionNode: React.FC<NodeProps<RevisionNodeData>> = ({ data, selected }) => {

    const statusColor = getStatusColor(data.status);
    const showFlag = statusColor !== undefined;
    const isGreen = statusColor === 'success';
    const isYellow = statusColor === 'warning';
    const isRed = statusColor === 'error';

    // Determine border and background colors based on status and selection
    const getBorderColor = () => {
        if (selected) return '2px solid #1976d2';
        if (isRed) return '2px solid #f44336'; // Red border
        if (isYellow) return '2px solid #ff9800'; // Yellow/orange border
        if (isGreen) return '2px solid #4caf50'; // Green border
        return '1px solid #c4c4c4';
    };

    const getBackgroundColor = () => {
        if (isRed) return '#ffebee'; // Light red/pink background
        if (isYellow) return '#fff8e1'; // Light yellow background
        if (isGreen) return '#f1f8f4'; // Light green background
        return '#fff';
    };

    const getBoxShadow = () => {
        if (selected) return '0px 2px 10px rgba(25, 118, 210, 0.25)';
        if (isRed) return '0px 2px 8px rgba(244, 67, 54, 0.2)'; // Light red shadow
        if (isYellow) return '0px 2px 8px rgba(255, 152, 0, 0.2)'; // Light yellow shadow
        if (isGreen) return '0px 2px 8px rgba(76, 175, 80, 0.2)'; // Light green shadow
        return '0px 1px 4px rgba(0,0,0,0.12)';
    };

    return (
        <Box
            sx={{
                border: getBorderColor(),
                borderRadius: 2,
                bgcolor: getBackgroundColor(),
                boxShadow: getBoxShadow(),
                p: 2,
                minWidth: 200,
                position: 'relative'
            }}
        >
            <Handle type="target" position={Position.Left} />
            {showFlag && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                    }}
                >
                    <FlagIcon color={statusColor} fontSize="small" />
                </Box>
            )}
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                {data.designName}
            </Typography>
            {data.designName && (
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'normal', mb: 0.5 }}>
                    Revision {data.revision}
                </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
                {data.operationCode}
            </Typography>
            <Typography variant="caption" color="text.secondary">
                {new Date(data.timestamp).toLocaleString()}
            </Typography>
            <Handle type="source" position={Position.Right} />
        </Box>
    );
};

export default RevisionNode;

