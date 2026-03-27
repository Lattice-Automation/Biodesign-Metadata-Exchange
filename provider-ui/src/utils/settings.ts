/**
 * Settings management utilities
 * Handles loading and saving settings from localStorage
 */

export interface AutoHighlightRule {
  id: string;
  name: string;
  enabled: boolean;
  type: 'nucleotides_added' | 'timestamp_gap' | 'timestamp_gap_below' | 'operation_type' | 'suspected_ai_operations';
  threshold?: number; // For nucleotides_added: number of nucleotides; for timestamp_gap: number of days; for timestamp_gap_below: number of seconds
  selectedOperationTypes?: string[]; // For operation_type: array of operation codes to highlight
  autoScreen?: boolean; // If true, flagged revisions will be auto-screened (red status + comment)
}

export interface Settings {
  showLineNumbers: boolean;
  encryptionKey: string | null;
  autoHighlightRules: AutoHighlightRule[];
}

const DEFAULT_SETTINGS: Settings = {
  showLineNumbers: false,
  encryptionKey: null,
  autoHighlightRules: [
    {
      id: 'nucleotides-added-threshold',
      name: 'Highlight when nucleotides added in a single op exceed this threshold',
      enabled: false,
      type: 'nucleotides_added',
      threshold: 10,
    },
    {
      id: 'timestamp-gap-threshold',
      name: 'Highlight when time gap between consecutive operations exceeds threshold',
      enabled: false,
      type: 'timestamp_gap',
      threshold: 30, // days
    },
    {
      id: 'timestamp-gap-below-threshold',
      name: 'Highlight when time gap between consecutive operations is below threshold',
      enabled: false,
      type: 'timestamp_gap_below',
      threshold: 60, // seconds
    },
    {
      id: 'suspected-ai-operations',
      name: 'Highlight suspected AI operations',
      enabled: false,
      type: 'suspected_ai_operations',
    },
    {
      id: 'operation-type-filter',
      name: 'Highlight all operations of selected types',
      enabled: false,
      type: 'operation_type',
      selectedOperationTypes: [],
    },
  ],
};

const STORAGE_KEY = 'biodesign-metadata-settings';

/**
 * Loads settings from localStorage
 */
export const loadSettings = (): Settings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge default settings with stored settings, ensuring all default rules exist
      const merged = { ...DEFAULT_SETTINGS, ...parsed };
      const storedRuleIds = new Set((parsed.autoHighlightRules || []).map((r: AutoHighlightRule) => r.id));

      // Add any missing default rules
      DEFAULT_SETTINGS.autoHighlightRules.forEach(defaultRule => {
        if (!storedRuleIds.has(defaultRule.id)) {
          merged.autoHighlightRules.push(defaultRule);
        }
      });

      // Update existing rules with any new default properties
      const updatedRules = merged.autoHighlightRules.map((storedRule: AutoHighlightRule) => {
        const defaultRule = DEFAULT_SETTINGS.autoHighlightRules.find((r: AutoHighlightRule) => r.id === storedRule.id);
        if (defaultRule) {
          return { ...defaultRule, ...storedRule };
        }
        return storedRule;
      });

      // Reorder rules to match DEFAULT_SETTINGS order
      const ruleOrder = DEFAULT_SETTINGS.autoHighlightRules.map((r: AutoHighlightRule) => r.id);
      const orderedRules = ruleOrder
        .map((id: string) => updatedRules.find((r: AutoHighlightRule) => r.id === id))
        .filter((rule): rule is AutoHighlightRule => rule !== undefined);
      
      // Add any rules that aren't in the default list (shouldn't happen, but just in case)
      const remainingRules = updatedRules.filter((r: AutoHighlightRule) => !ruleOrder.includes(r.id));
      merged.autoHighlightRules = [...orderedRules, ...remainingRules];

      return merged;
    }
  } catch (error) {
    console.error('Failed to load settings from localStorage:', error);
  }
  return DEFAULT_SETTINGS;
};

/**
 * Saves settings to localStorage
 */
export const saveSettings = (settings: Settings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings to localStorage:', error);
  }
};

/**
 * Gets a specific setting value
 */
export const getSetting = <K extends keyof Settings>(key: K): Settings[K] => {
  const settings = loadSettings();
  return settings[key];
};

/**
 * Gets the encryption key, checking settings first, then falling back to environment variable
 */
export const getEncryptionKey = (): string => {
  const settings = loadSettings();
  if (settings.encryptionKey) {
    return settings.encryptionKey;
  }
  return process.env.REACT_APP_BMDE_ENCRYPTION_KEY || '';
};

