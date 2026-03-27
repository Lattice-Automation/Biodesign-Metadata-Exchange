/**
 * JSON Schema (draft 2020-12) for one changelog row.
 * Exported as JS for ESM compatibility (Node, Vite, tests) without JSON import attributes.
 * To obtain a `.json` file for external tools: `JSON.stringify(changelogEntrySchema, null, 2)`.
 */
export default {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://teselagen.github.io/biodesign/changelog-entry.schema.json",
  title: "BioDesign changelog entry",
  description:
    "One operation in the metadata changelog (operationCode, operationDetails, change, timestamp, tool).",
  type: "object",
  required: ["operationCode", "operationDetails", "change", "timestamp", "tool"],
  additionalProperties: true,
  properties: {
    operationCode: { type: "string" },
    operationDetails: { type: "object" },
    change: { type: "string" },
    timestamp: { type: "string" },
    tool: { type: "string" }
  }
};
