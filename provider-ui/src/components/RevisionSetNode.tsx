import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Select, MenuItem, FormControl, SelectChangeEvent } from '@mui/material';
import FlagIcon from '@mui/icons-material/Flag';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Revision } from '../utils';

export interface RevisionSetNodeData {
  startRevision: number;
  endRevision: number;
  revisions: Revision[];
  selectedRevision: number;
  metadataId?: string; // Optional metadataId for multi-tree layout
  designName?: string; // Optional design name for display
  onRevisionSelect: ((revision: number) => void) | ((revisionKey: string) => void); // Can be either format
}

const RevisionSetNode: React.FC<NodeProps<RevisionSetNodeData>> = ({ data, selected }) => {
  const { startRevision, endRevision, revisions, selectedRevision, metadataId, designName, onRevisionSelect } = data;
  const [open, setOpen] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside or when closeAllSelects event is fired
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if click is outside the node
      if (nodeRef.current && !nodeRef.current.contains(target)) {
        // Also check if click is outside the MUI menu (which is rendered in a portal)
        const menuElement = document.querySelector('[role="listbox"]');
        if (menuElement && !menuElement.contains(target)) {
          setOpen(false);
        } else if (!menuElement) {
          // Menu doesn't exist, so close
          setOpen(false);
        }
      }
    };

    const handleCloseAll = () => {
      setOpen(false);
    };

    if (open) {
      // Use a small delay to ensure the menu is rendered
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside, true); // Use capture phase
        window.addEventListener('closeAllSelects', handleCloseAll);
      }, 0);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      window.removeEventListener('closeAllSelects', handleCloseAll);
    };
  }, [open]);

  const handleChange = (event: SelectChangeEvent<number>) => {
    const revision = event.target.value as number;
    // If metadataId is available (multi-tree layout), use composite key; otherwise use revision number
    if (metadataId) {
      const revisionKey = `${metadataId}-${revision}`;
      (onRevisionSelect as unknown as (revisionKey: string) => void)(revisionKey);
    } else {
      (onRevisionSelect as unknown as (revision: number) => void)(revision);
    }
    setOpen(false);
  };

  // Stop event propagation to prevent ReactFlow from intercepting clicks
  const handleSelectClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    setOpen(true);
  };

  const handleSelectMouseDown = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  const handleSelectPointerDown = (event: React.PointerEvent) => {
    event.stopPropagation();
  };

  const handleFormControlMouseDown = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  const handleFormControlPointerDown = (event: React.PointerEvent) => {
    event.stopPropagation();
  };

  // Find the selected revision to display its operation code
  const selectedRev = revisions.find(r => r.revision === selectedRevision);

  // Get status color for flag icon
  const getStatusColor = (status: string | undefined): 'error' | 'warning' | 'success' | undefined => {
    if (!status || status === '') return undefined;
    if (status === 'red') return 'error';
    if (status === 'yellow') return 'warning';
    if (status === 'green') return 'success';
    return undefined;
  };

  // Calculate the most severe status from all revisions in the set
  // Priority: red > yellow > green > none
  const getMostSevereStatus = (): 'error' | 'warning' | 'success' | undefined => {
    let hasRed = false;
    let hasYellow = false;
    let hasGreen = false;

    for (const rev of revisions) {
      if (rev.status === 'red') {
        hasRed = true;
      } else if (rev.status === 'yellow') {
        hasYellow = true;
      } else if (rev.status === 'green') {
        hasGreen = true;
      }
    }

    if (hasRed) return 'error';
    if (hasYellow) return 'warning';
    if (hasGreen) return 'success';
    return undefined;
  };

  const setStatusColor = getMostSevereStatus();
  const showSetFlag = setStatusColor !== undefined;
  const isGreen = setStatusColor === 'success';
  const isYellow = setStatusColor === 'warning';
  const isRed = setStatusColor === 'error';

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
      ref={nodeRef}
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
      {showSetFlag && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
          }}
        >
          <FlagIcon color={setStatusColor} fontSize="small" />
        </Box>
      )}
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        {designName}
      </Typography>
      {designName && (
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'normal', mb: 1 }}>
          Revisions {startRevision} → {endRevision}
        </Typography>
      )}
      <FormControl 
        fullWidth 
        size="small" 
        onClick={handleSelectClick}
        onMouseDown={handleFormControlMouseDown}
        onPointerDown={handleFormControlPointerDown}
        sx={{ pointerEvents: 'auto' }}
      >
        <Select
          value={selectedRevision}
          onChange={handleChange}
          displayEmpty
          open={open}
          onOpen={() => setOpen(true)}
          onClose={() => setOpen(false)}
          onClick={handleSelectClick}
          onMouseDown={handleSelectMouseDown}
          onPointerDown={handleSelectPointerDown}
          sx={{ 
            fontSize: '0.875rem',
            pointerEvents: 'auto',
            '& .MuiSelect-select': {
              pointerEvents: 'auto',
            },
          }}
          MenuProps={{
            style: { zIndex: 10000 }, // Ensure dropdown appears above ReactFlow
            disablePortal: false, // Allow menu to render in portal (default)
            onClose: (event, reason) => {
              // Always close, regardless of reason (backdrop click, escape, etc.)
              setOpen(false);
            },
            // Ensure backdrop is clickable
            BackdropProps: {
              onClick: (e: React.MouseEvent) => {
                e.stopPropagation(); // Prevent ReactFlow from handling this
                setOpen(false);
              },
              style: { pointerEvents: 'auto' }, // Ensure backdrop receives clicks
            },
            // Make sure the menu container can receive clicks
            PaperProps: {
              onClick: (e: React.MouseEvent) => {
                e.stopPropagation(); // Prevent clicks inside menu from closing
              },
            },
          }}
        >
          {revisions.map((rev) => {
            const statusColor = getStatusColor(rev.status);
            const showFlag = rev.revision !== selectedRevision && statusColor !== undefined;
            
            return (
              <MenuItem key={rev.revision} value={rev.revision}>
                <Box display="flex" alignItems="center" gap={1} width="100%">
                  <Box flex={1}>
                    {rev.revision}: {rev.operationCode}
                    {rev.revision !== selectedRevision && (
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        ({new Date(rev.timestamp).toLocaleString()})
                      </Typography>
                    )}
                  </Box>
                  {showFlag && (
                    <FlagIcon 
                      color={statusColor} 
                      fontSize="small"
                      sx={{ flexShrink: 0 }}
                    />
                  )}
                </Box>
              </MenuItem>
            );
          })}
        </Select>
      </FormControl>
      {selectedRev && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {new Date(selectedRev.timestamp).toLocaleString()}
        </Typography>
      )}
      <Handle type="source" position={Position.Right} />
    </Box>
  );
};

export default RevisionSetNode;

