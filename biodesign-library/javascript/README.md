# BioDesign metadata — integration checklist

Use this when wiring a design tool to produce **BioDesign-compatible** metadata and optional zip exports.  See the example implementation in the Open Vector Editor (OVE).

## 1. Decide what you already have

- [ ] **Design state** you can snapshot before/after each operation (or at least for export).
- [ ] **Sequence string** for **checksum** (same normalization as OVE: lowercased for SHA-256).
- [ ] **Undo or operation log** with either:
  - full snapshots + operation labels, or
  - a hand-built changelog array in the standard shape.

## 2. Serialize “whole design” to text for `change` diffs

- [ ] Implement **`serializeDesignToText(design)`** — often GenBank JSON → GenBank text (OVE uses `jsonToGenbank`), or your own canonical string.
- [ ] Pass it to **`editHistoryToChangelog`** from `changelog.js` **or** build changelog rows yourself with valid **`change`** patches.

## 3. Build the changelog

- [ ] **Order:** oldest operation first; last entry before export may be **EXPORT** if you mirror OVE.
- [ ] Each row must include: **`operationCode`**, **`operationDetails`**, **`change`**, **`timestamp`**, **`tool`**.
- [ ] Run **`validateChangelogEntry`** on each row and **`validateMetadata`** on the final object before writing (see `validation.js`).

## 4. Build metadata

- [ ] Call **`buildMetadata`** (`primitives.js`) with at least: `designName`, `design` (sequence for checksum), `changelog`, and optional `author`, `description`, `id`, `lastUpdated`.
- [ ] Confirm **`validateMetadata`** passes.

## 5. Optional: encryption

- [ ] If users encrypt metadata files, use **`encryptMetadataAsync`** / **`decryptMetadataAsync`** (same key derivation as NTI for interoperability).

## 6. Optional: zip bundle (OVE-compatible layout)

- [ ] Sequence file: GenBank/GenPept **`{designName}.{gb|gp}`** and/or FASTA **`{designName}.{fasta|faa}`** (OVE offers both menu entries; same metadata).
- [ ] Metadata: **`metadata_{designName}.json`** (plaintext) or **`metadata_{designName}.txt`** (encrypted, base64 payload from `encryptMetadataAsync`).
- [ ] Use **`buildBioDesignExportZipBlob`** from `exportZip.js` with **`sequenceFile: { content, extension }`**.
- [ ] **Changelog `change` diffs:** OVE keeps **GenBank** serialization for patch text even when the zip contains FASTA — see [BIODESIGN_EXPORT_PERFORMANCE.md](./BIODESIGN_EXPORT_PERFORMANCE.md).

## 7. Types and schemas

- [ ] TypeScript: import types from **`types.d.ts`** (`BioDesignMetadata`, `ChangelogEntry`, `EditDescriptor`, etc.).
- [ ] Runtime validation: **`validateMetadata`** / **`validateChangelogEntry`** (AJV + `schemas/*.schema.js`). For a static JSON file for CI, `JSON.stringify` the default export from those modules.

## 8. Persistence of edit history (OVE-specific reference)

- [ ] If you use a Redux undo stack like OVE: each stack entry should carry **`editDescriptor`** (and snapshot) so **`editHistoryToChangelog`** can map operations. Other state models: ensure you can still produce the same changelog shape.

## Quick import map

| Need | Module path |
|------|-------------|
| Timestamp, checksum, diff, `buildMetadata`, encrypt | `primitives.js` |
| Past stack → changelog | `changelog.js` |
| Descriptor → `operationCode` / `operationDetails` | `descriptorMapping.js` |
| Validation | `validation.js` |
| Zip blob | `exportZip.js` |
| TS types | `types.d.ts` |
| JSON Schema | `schemas/` |

For API details, see inline JSDoc in each module in this directory.
