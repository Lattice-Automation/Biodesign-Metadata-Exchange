import React, { useState, useEffect } from 'react';
import { Box, Card, CardContent, Typography, FormControlLabel, Switch, Stack, Divider, IconButton, TextField, Select, MenuItem, FormControl, InputLabel, Chip, OutlinedInput } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';
import { Header } from '../components';
import { loadSettings, saveSettings, type Settings as SettingsType } from '../utils/settings';

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<SettingsType>(loadSettings());

  // Save settings to localStorage whenever they change
  useEffect(() => {
    saveSettings(settings);
    // Trigger update by dispatching a custom event
    window.dispatchEvent(new CustomEvent('settingsChanged', { detail: settings }));
  }, [settings]);

  const handleToggle = (key: keyof SettingsType) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleTextChange = (key: keyof SettingsType, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value || null,
    }));
  };

  const handleRuleToggle = (ruleId: string) => {
    setSettings((prev) => ({
      ...prev,
      autoHighlightRules: prev.autoHighlightRules.map(rule =>
        rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
      ),
    }));
  };

  const handleRuleThresholdChange = (ruleId: string, threshold: number) => {
    setSettings((prev) => ({
      ...prev,
      autoHighlightRules: prev.autoHighlightRules.map(rule =>
        rule.id === ruleId ? { ...rule, threshold } : rule
      ),
    }));
  };

  const handleRuleOperationTypesChange = (ruleId: string, operationTypes: string[]) => {
    setSettings((prev) => ({
      ...prev,
      autoHighlightRules: prev.autoHighlightRules.map(rule =>
        rule.id === ruleId ? { ...rule, selectedOperationTypes: operationTypes } : rule
      ),
    }));
  };

  const handleRuleAutoScreenToggle = (ruleId: string) => {
    setSettings((prev) => ({
      ...prev,
      autoHighlightRules: prev.autoHighlightRules.map(rule =>
        rule.id === ruleId ? { ...rule, autoScreen: !rule.autoScreen } : rule
      ),
    }));
  };

  // Common operation types that might appear in the metadata
  const operationTypes = [
    'CREATE',
    'CREATE_PROTEIN',
    'OPEN',
    'OPEN_PROTEIN',
    'INSERT',
    'DELETE',
    'APPEND',
    'PASTE',
    'COPY',
    'SPLIT',
    'CODON_OPTIMIZATION',
    'ADD_ANNOTATION',
    'EXTRACT_BACKBONE',
    'REDESIGN_INTERFACE',
    'DESIGN_PROTEIN',
    'CALCULATE_PROTEIN_METRICS',
    'TRANSLATE_PROTEIN',
    'EXPORT',
    'EXPORT_PROTEIN',
    'IMPORT',
  ];

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

          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  WebApp Settings
                </Typography>
                <IconButton
                  onClick={() => navigate('/')}
                  aria-label="Back to home"
                  sx={{ color: 'text.primary' }}
                >
                  <HomeIcon />
                </IconButton>
              </Box>
              <Divider sx={{ my: 2 }} />

              <Stack spacing={3}>

                {/* Show Line Numbers */}
                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.showLineNumbers}
                        onChange={() => handleToggle('showLineNumbers')}
                      />
                    }
                    label="Show line numbers in code views"
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, ml: 4.5 }}>
                    Display line numbers in sequence and diff views
                  </Typography>
                </Box>

                <Divider />

                {/* Encryption Key */}
                <Box>
                  <Typography variant="body2" gutterBottom sx={{ mb: 1 }}>
                    Encryption Key
                  </Typography>
                  <TextField
                    type="password"
                    value={settings.encryptionKey || ''}
                    onChange={(e) => handleTextChange('encryptionKey', e.target.value)}
                    placeholder="Leave empty to use default key"
                    size="small"
                    fullWidth
                    sx={{ maxWidth: 600 }}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Enter an encryption key to decrypt encrypted (.txt) metadata files. Not needed for unencrypted (.json) metadata.
                  </Typography>
                </Box>

                <Divider />

                {/* Auto-Highlighting Rules */}
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Automated Rules
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Configure rules to automatically highlight nodes in yellow based on operation criteria.
                  </Typography>
                  
                  <Stack spacing={2}>
                    {settings.autoHighlightRules.map((rule) => (
                      <Box
                        key={rule.id}
                        sx={{
                          p: 2,
                          border: 1,
                          borderColor: 'grey.300',
                          borderRadius: 1,
                          bgcolor: 'grey.50',
                        }}
                      >
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <FormControlLabel
                            control={
                              <Switch
                                checked={rule.enabled}
                                onChange={() => handleRuleToggle(rule.id)}
                              />
                            }
                            label={
                              <Typography variant="body1" fontWeight={500}>
                                {rule.name}
                              </Typography>
                            }
                          />
                          <FormControlLabel
                            control={
                              <Switch
                                checked={rule.autoScreen || false}
                                onChange={() => handleRuleAutoScreenToggle(rule.id)}
                                disabled={!rule.enabled}
                                size="small"
                              />
                            }
                            label={
                              <Typography variant="body2" color="text.secondary">
                                Auto-Screen
                              </Typography>
                            }
                          />
                        </Box>
                        {rule.type === 'nucleotides_added' && (
                          <Box sx={{ mt: 2, ml: 4.5 }}>
                            <TextField
                              type="number"
                              label="Threshold (nucleotides)"
                              value={rule.threshold || 0}
                              onChange={(e) => {
                                const value = parseInt(e.target.value, 10);
                                if (!isNaN(value) && value >= 0) {
                                  handleRuleThresholdChange(rule.id, value);
                                }
                              }}
                              size="small"
                              sx={{ maxWidth: 200 }}
                              inputProps={{ min: 0 }}
                              helperText="e.g. a single Paste operation that added > X nucleotides"
                            />
                          </Box>
                        )}
                        {rule.type === 'timestamp_gap' && (
                          <Box sx={{ mt: 2, ml: 4.5 }}>
                            <TextField
                              type="number"
                              label="Threshold (days)"
                              value={rule.threshold || 0}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value);
                                if (!isNaN(value) && value >= 0) {
                                  handleRuleThresholdChange(rule.id, value);
                                }
                              }}
                              size="small"
                              sx={{ maxWidth: 200 }}
                              inputProps={{ min: 0, step: 0.1 }}
                              helperText=""
                            />
                          </Box>
                        )}
                        {rule.type === 'timestamp_gap_below' && (
                          <Box sx={{ mt: 2, ml: 4.5 }}>
                            <TextField
                              type="number"
                              label="Threshold (seconds)"
                              value={rule.threshold || 0}
                              onChange={(e) => {
                                const value = parseInt(e.target.value, 10);
                                if (!isNaN(value) && value >= 0) {
                                  handleRuleThresholdChange(rule.id, value);
                                }
                              }}
                              size="small"
                              sx={{ maxWidth: 200 }}
                              inputProps={{ min: 0 }}
                              helperText=""
                            />
                          </Box>
                        )}
                        {rule.type === 'suspected_ai_operations' && (
                          <Box sx={{ mt: 2, ml: 4.5 }}>
                            <Typography variant="body2" color="text.secondary">
                              Highlights: REDESIGN_INTERFACE, DESIGN_PROTEIN, CALCULATE_PROTEIN_METRICS
                            </Typography>
                          </Box>
                        )}
                        {rule.type === 'operation_type' && (
                          <Box sx={{ mt: 2, ml: 4.5 }}>
                            <FormControl fullWidth size="small" sx={{ maxWidth: 400 }}>
                              <InputLabel>Operation Types</InputLabel>
                              <Select
                                multiple
                                value={rule.selectedOperationTypes || []}
                                onChange={(e) => {
                                  const value = e.target.value as string[];
                                  handleRuleOperationTypesChange(rule.id, value);
                                }}
                                input={<OutlinedInput label="Operation Types" />}
                                renderValue={(selected) => (
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {(selected as string[]).map((value) => (
                                      <Chip key={value} label={value} size="small" />
                                    ))}
                                  </Box>
                                )}
                              >
                                {operationTypes.map((opType) => (
                                  <MenuItem key={opType} value={opType}>
                                    {opType}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                              Select one or more operation types to highlight
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    ))}
                  </Stack>
                </Box>

                <Divider />


              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </Box>
  );
};

export default Settings;

