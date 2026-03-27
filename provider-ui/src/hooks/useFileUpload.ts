import { useCallback, useRef, useState, DragEvent } from 'react';

interface UseFileUploadOptions {
  onFiles: (files: File[]) => void;
}

export const useFileUpload = ({ onFiles }: UseFileUploadOptions) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(event.dataTransfer.files ?? []);
    if (!droppedFiles.length) {
      return;
    }

    onFiles(droppedFiles);
  }, [onFiles]);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileDialogChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (fileList && fileList.length) {
      onFiles(Array.from(fileList));
      event.target.value = '';
    }
  }, [onFiles]);

  const handleZoneClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    fileInputRef,
    isDragging,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleFileDialogChange,
    handleZoneClick,
  };
};

