# BioDesign Library (All Languages)

This folder contains language-specific implementations of the same BMDE core logic:

- `python/`
- `typescript/`
- `java/`
- `javascript/`

At a high level, each library is designed to do the same job:

1. **Create metadata** for a biological design  
2. **Append operations** to a changelog as edits happen  
3. **Protect integrity** with a sequence checksum  
4. **Capture textual diffs** for each operation  
5. **Reconstruct revisions** from the latest design + changelog  
6. **Encrypt/decrypt metadata** (when encryption is enabled)

---

## Core Data Model

Each implementation uses the same metadata shape:

- `id`: unique metadata identifier
- `parentMetadataId`: parent design metadata id (for derived designs)
- `designName`: design name
- `designChecksum`: SHA-256 checksum of design sequence/content
- `author`: author/source
- `description`: free-text description
- `lastUpdated`: timestamp of latest metadata update
- `changelog`: ordered list of operations (oldest -> newest)

Each changelog operation includes:

- `operationCode`
- `operationDetails`
- `change` (diff patch text)
- `timestamp`
- `tool`
- optional annotation fields like `comments` and `status` (where supported)

---

## Shared Workflow

### 1) Create metadata

When a new design is created/opened, the library can generate an initial metadata object and typically write:

- `library/metadata_<designName>.json`

### 2) Update metadata per operation

After each edit operation (insert/delete/annotate/export/etc.), the library:

- recalculates `designChecksum`
- appends a new changelog entry
- updates `lastUpdated`

### 3) Compute difference patches

Libraries use `diff_match_patch`-style patch text to store what changed between states.

### 4) Recompute revisions

Given the **latest design** and **changelog**, libraries reconstruct historical revisions by applying patches in reverse order.

### 5) Optional encryption

Libraries support encrypting metadata payloads (commonly exported as `.txt`) and decrypting them for interpretation.

---

## Interoperability Intent

The goal is that metadata captured by one implementation can be interpreted by another tool/language, as long as:

- checksum and diff semantics are aligned
- operation payloads are BMDE-compatible
- encryption mode/key handling are compatible (if encryption is used)

---

## Notes

- These libraries are intended as **reference and integration tooling** for BMDE adoption.
- APIs may differ slightly by language, but behavior is intended to stay aligned.
- For practical usage examples, see the repository root `README.md` and demo tooling in:
  - `biodesign-tool/`
  - `provider-backend/`
  - `provider-ui/`
