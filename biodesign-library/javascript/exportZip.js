/**
 * Build a Zip blob with a sequence file (GenBank, GenPept, FASTA, etc.) + metadata JSON or encrypted metadata .txt.
 *
 * **Changelog `change` diffs (elsewhere):** OVE always computes patches from **full GenBank text** via
 * `oveEditHistoryToChangelog` so reconstructions stay annotation-aware. Exporting **FASTA** in the zip only
 * changes the human-readable sequence file; it does not switch the changelog to FASTA-based diffs.
 *
 * @param {object} options
 * @param {object} options.metadata - BioDesign metadata object (e.g. from buildMetadata)
 * @param {string} options.designName - Base name for files (sanitized for safe filenames)
 * @param {string} [options.encryptKey] - If non-empty, writes metadata_${name}.txt (encrypted). Otherwise metadata_${name}.json
 * @param {(metadata: object, key: string) => Promise<string>} [options.encryptMetadata] - Defaults to encryptMetadataAsync from primitives
 *
 * **Sequence file (provide one style):**
 * @param {{ content: string, extension: string }} [options.sequenceFile] - e.g. `{ content, extension: 'gb'|'gp'|'fasta'|'faa' }`
 * @param {string} [options.genbankText] - Legacy: GenBank/GenPept text (use with genbankExtension)
 * @param {string} [options.genbankExtension='gb'] - Legacy: used with genbankText only
 * @returns {Promise<Blob>}
 */
import JSZip from "jszip";
import { encryptMetadataAsync } from "./primitives.js";

function safeBaseName(name) {
  const s = String(name || "Untitled_Sequence").trim() || "Untitled_Sequence";
  return s.replace(/[/\\?%*:|"<>]/g, "_");
}

function resolveSequenceFile(options) {
  if (options.sequenceFile && typeof options.sequenceFile.content === "string") {
    const ext = String(options.sequenceFile.extension || "gb").replace(/^\./, "");
    return { content: options.sequenceFile.content, ext };
  }
  if (typeof options.genbankText === "string") {
    const genbankExtension = options.genbankExtension === "gp" ? "gp" : "gb";
    return { content: options.genbankText, ext: genbankExtension };
  }
  return null;
}

export async function buildBioDesignExportZipBlob(options = {}) {
  const {
    metadata,
    designName,
    encryptKey,
    encryptMetadata = encryptMetadataAsync
  } = options;

  const resolved = resolveSequenceFile(options);
  if (!resolved) {
    throw new TypeError(
      "buildBioDesignExportZipBlob: provide sequenceFile: { content, extension } or genbankText (legacy)"
    );
  }
  if (metadata === null || typeof metadata !== "object") {
    throw new TypeError("buildBioDesignExportZipBlob: metadata must be an object");
  }

  const base = safeBaseName(designName);
  // Provider-side matching relies on metadata.designName matching the design filename base.
  // Fail early if they diverge due to sanitization or caller mismatch.
  if (typeof metadata.designName !== "string" || metadata.designName.trim() === "") {
    throw new TypeError("buildBioDesignExportZipBlob: metadata.designName must be a non-empty string");
  }
  if (metadata.designName !== base) {
    throw new Error(
      `buildBioDesignExportZipBlob: metadata.designName ("${metadata.designName}") must match sanitized designName ("${base}")`
    );
  }
  const zip = new JSZip();
  const now = new Date();

  zip.file(`${base}.${resolved.ext}`, resolved.content, { date: now });

  const key = typeof encryptKey === "string" ? encryptKey.trim() : "";
  if (key) {
    const encryptedContent = await encryptMetadata(metadata, key);
    zip.file(`metadata_${base}.txt`, encryptedContent, { date: now });
  } else {
    zip.file(
      `metadata_${base}.json`,
      JSON.stringify(metadata, null, 4),
      { date: now }
    );
  }

  return zip.generateAsync({ type: "blob" });
}
