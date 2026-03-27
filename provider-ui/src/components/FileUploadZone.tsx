import React, { DragEvent, ReactNode } from 'react';
import { Box } from '@mui/material';

interface FileUploadZoneProps {
    onDrop: (event: DragEvent<HTMLDivElement>) => void;
    onDragOver: (event: DragEvent<HTMLDivElement>) => void;
    onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
    isDragging: boolean;
    children: ReactNode;
    sx?: object;
}

const FileUploadZone: React.FC<FileUploadZoneProps> = ({
    onDrop,
    onDragOver,
    onDragLeave,
    isDragging,
    children,
    sx = {},
}) => {
    return (
        <Box
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            sx={{
                border: isDragging ? '2px dashed #1976d2' : undefined,
                ...sx,
            }}
        >
            {children}
        </Box>
    );
};

export default FileUploadZone;

