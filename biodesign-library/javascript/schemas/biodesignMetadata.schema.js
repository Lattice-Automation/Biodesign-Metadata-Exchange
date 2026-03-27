/**
 * JSON Schema (draft 2020-12) for top-level BioDesign metadata.
 * Exported as JS for ESM compatibility (Node, Vite, tests) without JSON import attributes.
 * To obtain a `.json` file for external tools: `JSON.stringify(biodesignMetadataSchema, null, 2)`.
 */
export default {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://teselagen.github.io/biodesign/metadata.schema.json",
  title: "BioDesign metadata",
  description: "Top-level metadata object (design name, checksum, changelog, etc.).",
  type: "object",
  required: [
    "id",
    "parentMetadataId",
    "designName",
    "designChecksum",
    "author",
    "description",
    "lastUpdated",
    "changelog"
  ],
  additionalProperties: true,
  properties: {
    id: { type: "string" },
    parentMetadataId: { type: "string" },
    designName: { type: "string" },
    designChecksum: { type: "string" },
    author: { type: "string" },
    description: { type: "string" },
    lastUpdated: { type: "string" },
    changelog: {
      type: "array",
      items: {
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
      }
    }
  }
};
