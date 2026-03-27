/**
 * Map an edit descriptor to BioDesign changelog operationCode and operationDetails.
 * Default mapping; tools can override or extend when using editHistoryToChangelog.
 *
 * @param {object} editDescriptor - { type, label?, position?, start?, end?, insertedBases?, deletedBases?, ... }
 * @returns {{ operationCode: string, operationDetails: object }}
 */
export function mapDescriptorToOperation(editDescriptor) {
  const d = editDescriptor || {};
  const type = (d.type || "").toUpperCase();

  if (type === "CREATE") {
    return {
      operationCode: "CREATE",
      operationDetails: { label: d.label ?? "Create design" }
    };
  }
  if (type === "INSERT" || type === "PASTE") {
    return {
      operationCode: type,
      operationDetails: {
        insert_position: d.position ?? 0,
        insert_sequence: d.insertedBases ?? ""
      }
    };
  }
  if (type === "DELETE" || type === "CUT") {
    return {
      operationCode: type,
      operationDetails: {
        delete_start_position: d.start ?? 0,
        delete_end_position: d.end ?? 0
      }
    };
  }
  if (type === "SEQUENCE_REPLACE") {
    return {
      operationCode: "SEQUENCE_REPLACE",
      operationDetails: {
        start: d.start ?? 0,
        end: d.end ?? 0,
        insert_sequence: d.insertedBases ?? ""
      }
    };
  }
  if (type === "CHANGE_CASE") {
    const details = { label: d.label ?? "" };
    if (d.start != null && d.end != null) {
      details.start = d.start;
      details.end = d.end;
    }
    return {
      operationCode: "CHANGE_CASE",
      operationDetails: details
    };
  }

  // All other types (RENAME_SEQUENCE, TOGGLE_CIRCULARITY, ADD_FEATURE, EDIT_FEATURE, etc.)
  return {
    operationCode: type || "EDIT",
    operationDetails: {
      label: d.label ?? "",
      ...(d.start != null && { start: d.start }),
      ...(d.end != null && { end: d.end })
    }
  };
}
