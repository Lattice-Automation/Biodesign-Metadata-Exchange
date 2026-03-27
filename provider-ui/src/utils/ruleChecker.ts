/**
 * Rule checking utilities for auto-highlighting nodes
 */

import { Revision } from '../ProviderTool';
import { loadSettings } from './settings';

/**
 * Counts nucleotides in a text string
 */
function countNucleotidesInText(text: string): number {
  if (!text) return 0;
  const nucleotides = text.match(/[atgcnATCGN]/g);
  return nucleotides ? nucleotides.length : 0;
}

/**
 * Counts the number of nucleotides added in a diff string
 * The diff format is from diff_match_patch library
 * Format: "@@ -start,length +start,length @@\n+added text\n-removed text"
 * 
 * Note: The diff may contain multiple hunks, each starting with @@
 */
function countAddedNucleotidesFromDiff(diff: string): number {
  if (!diff) return 0;

  let addedCount = 0;
  const lines = diff.split('\n');

  for (const line of lines) {
    // Lines starting with '+' indicate additions (but skip the header lines that start with '@@')
    // Also skip lines that are just '+' (empty additions)
    if (line.startsWith('+') && !line.startsWith('@@') && line.length > 1) {
      // Remove the '+' prefix and count the characters
      const addedText = line.substring(1);
      addedCount += countNucleotidesInText(addedText);
    }
  }

  return addedCount;
}

/**
 * Counts nucleotides added for a specific operation
 * For PASTE operations, checks operationDetails.pasted_text
 * For INSERT operations, checks operationDetails.insert_sequence
 * For other operations, parses the diff string
 */
function countAddedNucleotides(revision: Revision): number {
  // For PASTE operations, check pasted_text in operationDetails
  if (revision.operationCode === 'PASTE' && revision.operationDetails?.pasted_text) {
    const pastedText = revision.operationDetails.pasted_text;
    // pasted_text can be an array of strings or a single string
    if (Array.isArray(pastedText)) {
      return pastedText.reduce((total, text) => total + countNucleotidesInText(text), 0);
    } else if (typeof pastedText === 'string') {
      return countNucleotidesInText(pastedText);
    }
  }

  // For INSERT operations, check insert_sequence in operationDetails
  if (revision.operationCode === 'INSERT' && revision.operationDetails?.insert_sequence) {
    return countNucleotidesInText(revision.operationDetails.insert_sequence);
  }

  // For APPEND operations, check appended_sequence in operationDetails (if available)
  if (revision.operationCode === 'APPEND' && revision.operationDetails?.appended_sequence) {
    return countNucleotidesInText(revision.operationDetails.appended_sequence);
  }

  // For other operations, parse the diff (fallback)
  return countAddedNucleotidesFromDiff(revision.change || '');
}

/**
 * Calculates the time gap in days between two timestamps
 */
function calculateTimeGapDays(timestamp1: string, timestamp2: string): number {
  try {
    const date1 = new Date(timestamp1);
    const date2 = new Date(timestamp2);
    const diffMs = Math.abs(date2.getTime() - date1.getTime());
    return diffMs / (1000 * 60 * 60 * 24); // Convert to days
  } catch (error) {
    return 0;
  }
}

/**
 * Calculates the time gap in seconds between two timestamps
 */
function calculateTimeGapSeconds(timestamp1: string, timestamp2: string): number {
  try {
    const date1 = new Date(timestamp1);
    const date2 = new Date(timestamp2);
    const diffMs = Math.abs(date2.getTime() - date1.getTime());
    return diffMs / 1000; // Convert to seconds
  } catch (error) {
    return 0;
  }
}

/**
 * Checks if a revision matches any enabled auto-highlighting rules
 * Returns status 'flagged' when a rule matches, '' (default) otherwise.
 * Preserves marked_safe/marked_unsafe (user overrides).
 *
 * @param revision - The revision to check
 * @param previousRevision - The previous revision in the sequence (for timestamp gap checking)
 * @returns Object with status, matched rule ID, and whether to add auto-screen comment
 */
export function checkRulesForRevision(
  revision: Revision,
  previousRevision?: Revision
): { status: string; matchedRuleId?: string; addAutoScreenComment?: boolean } {
  const settings = loadSettings();
  const enabledRules = settings.autoHighlightRules.filter(rule => rule.enabled);

  if (enabledRules.length === 0) {
    return { status: revision.status || '' };
  }

  if (revision.status === 'marked_safe' || revision.status === 'marked_unsafe') {
    return { status: revision.status };
  }

  for (const rule of enabledRules) {
    let matches = false;

    if (rule.type === 'nucleotides_added') {
      const addedCount = countAddedNucleotides(revision);
      matches = addedCount > (rule.threshold || 0);
    } else if (rule.type === 'timestamp_gap' && previousRevision) {
      const gapDays = calculateTimeGapDays(previousRevision.timestamp, revision.timestamp);
      matches = gapDays > (rule.threshold || 0);
    } else if (rule.type === 'timestamp_gap_below' && previousRevision) {
      const gapSeconds = calculateTimeGapSeconds(previousRevision.timestamp, revision.timestamp);
      matches = gapSeconds < (rule.threshold || 0);
    } else if (rule.type === 'operation_type') {
      if (rule.selectedOperationTypes && rule.selectedOperationTypes.length > 0) {
        matches = rule.selectedOperationTypes.includes(revision.operationCode);
      }
    } else if (rule.type === 'suspected_ai_operations') {
      const suspectedAIOperations = ['REDESIGN_INTERFACE', 'DESIGN_PROTEIN', 'CALCULATE_PROTEIN_METRICS'];
      matches = suspectedAIOperations.includes(revision.operationCode);
    }

    if (matches) {
      return {
        status: 'flagged',
        matchedRuleId: rule.id,
        addAutoScreenComment: !!rule.autoScreen,
      };
    }
  }

  return { status: revision.status || '' };
}

/**
 * Applies auto-highlighting rules to a list of revisions
 * Only applies rules to revisions that don't already have a status
 * Revisions should be sorted by revision number (ascending) for timestamp gap checking
 * 
 * @returns Object with revisions and rule statistics
 */
export function applyRulesToRevisions(revisions: Revision[]): {
  revisions: Revision[];
  ruleStats: Map<string, number>; // Map of rule ID to count of flagged revisions
} {
  // Sort revisions by revision number to ensure proper order for timestamp gap checking
  const sortedRevisions = [...revisions].sort((a, b) => a.revision - b.revision);
  const ruleStats = new Map<string, number>();
  const settings = loadSettings();
  
  const updatedRevisions = sortedRevisions.map((revision, index) => {
    // Get previous revision for timestamp gap checking
    const previousRevision = index > 0 ? sortedRevisions[index - 1] : undefined;
    const result = checkRulesForRevision(revision, previousRevision);
    
    if (result.status === 'flagged' && result.matchedRuleId) {
      ruleStats.set(result.matchedRuleId, (ruleStats.get(result.matchedRuleId) || 0) + 1);
    }

    let comments = revision.comments || [];

    if (result.status === 'flagged' && result.matchedRuleId) {
      const matchedRule = settings.autoHighlightRules.find(r => r.id === result.matchedRuleId);
      if (matchedRule) {
        const ruleComment = {
          timestamp: revision.timestamp, // Use revision timestamp for consistency
          text: `Flagged by rule: ${matchedRule.name}`,
        };
        // Check if comment already exists to avoid duplicates
        const commentExists = comments.some(
          c => c.text === ruleComment.text
        );
        if (!commentExists) {
          comments = [...comments, ruleComment];
        }
      }
    }
    
    if (result.addAutoScreenComment) {
      const autoScreenComment = {
        timestamp: revision.timestamp,
        text: 'Auto-screening recommended',
      };
      // Check if comment already exists to avoid duplicates
      const commentExists = comments.some(
        c => c.text === autoScreenComment.text
      );
      if (!commentExists) {
        comments = [...comments, autoScreenComment];
      }
    }
    
    return {
      ...revision,
      status: result.status,
      comments,
    };
  });
  
  return {
    revisions: updatedRevisions,
    ruleStats,
  };
}
