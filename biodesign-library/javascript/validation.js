/**
 * Validation against JSON Schema files in ./schemas/ (AJV draft 2020-12).
 * Falls back to no schema if AJV compile fails (should not happen in normal builds).
 */

import Ajv2020 from "ajv/dist/2020.js";
import biodesignMetadataSchema from "./schemas/biodesignMetadata.schema.js";
import changelogEntrySchema from "./schemas/changelogEntry.schema.js";

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateMetadataCompiled = ajv.compile(biodesignMetadataSchema);
const validateChangelogEntryCompiled = ajv.compile(changelogEntrySchema);

function errorsFromValidate(validateFn) {
  const errs = validateFn.errors;
  if (!errs || !errs.length) {
    return ["Validation failed"];
  }
  return errs.map(e => {
    const path = e.instancePath === "" ? "/" : e.instancePath;
    return `${path} ${e.message}`.trim();
  });
}

/**
 * Validate a single changelog entry against `schemas/changelogEntry.schema.js`.
 * @param {unknown} entry
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateChangelogEntry(entry) {
  const valid = validateChangelogEntryCompiled(entry);
  if (valid) return { valid: true, errors: [] };
  return { valid: false, errors: errorsFromValidate(validateChangelogEntryCompiled) };
}

/**
 * Validate top-level BioDesign metadata against `schemas/biodesignMetadata.schema.js`.
 * @param {unknown} obj
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateMetadata(obj) {
  const valid = validateMetadataCompiled(obj);
  if (valid) return { valid: true, errors: [] };
  return { valid: false, errors: errorsFromValidate(validateMetadataCompiled) };
}

/**
 * Lightweight check for an edit descriptor (undo stack / persistence); not in JSON Schema.
 * @param {unknown} d
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateEditDescriptor(d) {
  const errors = [];
  if (d === null || typeof d !== "object" || Array.isArray(d)) {
    return { valid: false, errors: ["editDescriptor must be a non-null object"] };
  }
  if (typeof d.type !== "string" || !d.type.length) {
    errors.push("type must be a non-empty string");
  }
  return { valid: errors.length === 0, errors };
}
