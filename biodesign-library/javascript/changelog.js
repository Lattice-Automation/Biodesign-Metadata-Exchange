/**
 * Turn edit history (e.g. undo stack + current design) into a BioDesign changelog.
 * Tool-agnostic: caller provides serializeDesignToText(design).
 *
 * @param {Array<{ designSnapshot: object, editDescriptor?: object }>} past - Oldest first
 * @param {object} currentDesign - Current state (same type as designSnapshot)
 * @param {object} options
 * @param {(design: object) => string} options.serializeDesignToText - Serialize one design to string (e.g. GenBank)
 * @param {string} [options.toolName] - Default 'Tool'
 * @param {string} [options.timestamp] - Optional fixed timestamp for all entries
 * @param {(entry: object, nextDesign: object, change: string) => object} [options.mapDescriptorToChangelogEntry] - Optional custom mapper; receives (entry, nextDesign, change), returns { operationCode, operationDetails, change, timestamp, tool }
 * @returns {Array<{ operationCode: string, operationDetails: object, change: string, timestamp: string, tool: string }>}
 */

import { computeTextDiff, formatTimestamp } from "./primitives.js";
import { mapDescriptorToOperation } from "./descriptorMapping.js";

export function editHistoryToChangelog(past, currentDesign, options = {}) {
  if (!Array.isArray(past) || past.length === 0) return [];

  const {
    serializeDesignToText,
    toolName = "Tool",
    timestamp,
    mapDescriptorToChangelogEntry
  } = options;

  if (typeof serializeDesignToText !== "function") {
    return [];
  }

  return past.map((entry, i) => {
    const beforeDesign = entry.designSnapshot ?? entry.sequenceData;
    const afterDesign =
      i < past.length - 1
        ? past[i + 1].designSnapshot ?? past[i + 1].sequenceData
        : currentDesign;

    const beforeText = serializeDesignToText(beforeDesign);
    const afterText = serializeDesignToText(afterDesign);
    const change = computeTextDiff(beforeText, afterText);

    const editDescriptor = entry.editDescriptor || {};
    const rowTimestamp =
      timestamp ||
      entry.timestamp ||
      editDescriptor.timestamp ||
      formatTimestamp(new Date());

    if (typeof mapDescriptorToChangelogEntry === "function") {
      return mapDescriptorToChangelogEntry(entry, afterDesign, change);
    }

    const { operationCode, operationDetails } = mapDescriptorToOperation(
      editDescriptor
    );

    return {
      operationCode,
      operationDetails,
      change,
      timestamp: rowTimestamp,
      tool: toolName
    };
  });
}
