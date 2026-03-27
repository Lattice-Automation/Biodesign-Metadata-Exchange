"""
MetadataEvaluator - High-level orchestrator for evaluating biodesign metadata.
"""

import json
import os
import shutil
import tempfile
from datetime import datetime
from io import StringIO
from pathlib import Path
import re
from typing import Dict, List, Optional, Set, Tuple, Union

from Bio import SeqIO

from biodesign_metadata.core import BioDesignMetadataLibrary
from biodesign_metadata.exceptions import ChecksumMismatchError, DecryptionError, ValidationError
from biodesign_metadata.models import (
    EvaluatedRevision,
    EvaluationResult,
    EvaluationSummary,
    FLAGGED_STATUSES,
)
from biodesign_metadata.rules import (
    apply_rules_to_revisions,
    compute_final_recommendation,
    compute_revision_status,
    load_rules_config,
)


def _parse_timestamp(ts: str):
    """Parse timestamp string; supports ISO and MM/DD/YYYY formats."""
    from datetime import datetime

    if not ts:
        return None
    ts = ts.strip()
    for fmt in ("%m/%d/%Y, %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(ts, fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        return None


class MetadataEvaluator:
    """
    Evaluates design files and their metadata.
    Supports GenBank (.gb, .gbk), FASTA (.fasta, .fa, .faa, .fna), PDB (.pdb) design files.
    Supports encrypted (.txt) and plain (.json) metadata files.
    """

    def __init__(
        self,
        encryption_key: Optional[str] = None,
        rules_config_path: Optional[str] = None,
    ):
        """
        Initialize the evaluator.

        Args:
            encryption_key: Overrides BMDE_ENCRYPTION_KEY env var if provided.
            rules_config_path: Path to custom rules JSON. Overrides BMDE_RULES_CONFIG env var.
        """
        self._encryption_key = encryption_key or os.getenv("BMDE_ENCRYPTION_KEY")
        self._rules_config_path = rules_config_path
        self._core = BioDesignMetadataLibrary()

    def evaluate(self, design_path: str, metadata_path: str) -> EvaluationResult:
        """
        Run the full evaluation pipeline:
        load metadata -> verify checksum -> compute revisions -> apply rules -> build summary.
        """
        warnings: List[str] = []

        try:
            metadata_json = self._load_metadata(metadata_path)
            design_content, is_pdb = self._load_design(design_path)
            self._verify_checksum(design_content, metadata_json, is_pdb)

            raw_revisions = self._compute_revisions(design_content, metadata_json, is_pdb)
            rules, final_rec_config = load_rules_config(self._rules_config_path)
            revisions_with_rules, rule_stats = apply_rules_to_revisions(raw_revisions, rules)

            summary = self._build_summary(
                metadata_json, revisions_with_rules, rule_stats, rules, final_rec_config
            )

            evaluated = [
                EvaluatedRevision(
                    revision=r["revision"],
                    design=r["design"],
                    operation_code=r["operationCode"],
                    operation_details=r.get("operationDetails", {}),
                    change=r.get("change", ""),
                    timestamp=r.get("timestamp", ""),
                    tool=r.get("tool", ""),
                    comments=r.get("comments", []),
                    status=r.get("status", "default"),
                    auto_screening_recommended=r.get("auto_screening_recommended", False),
                )
                for r in revisions_with_rules
            ]

            return EvaluationResult(
                success=True,
                metadata_id=metadata_json.get("id"),
                parent_metadata_id=metadata_json.get("parentMetadataId"),
                design_name=metadata_json.get("designName"),
                author=metadata_json.get("author"),
                description=metadata_json.get("description"),
                last_updated=metadata_json.get("lastUpdated"),
                revisions=evaluated,
                summary=summary,
                warnings=warnings,
                metadata_json=metadata_json,
            )

        except DecryptionError as e:
            return EvaluationResult(
                success=False,
                error=f"Failed to decrypt metadata: {e}. Ensure BMDE_ENCRYPTION_KEY is set and matches the key used to encrypt the metadata.",
            )
        except ChecksumMismatchError as e:
            return EvaluationResult(success=False, error=str(e))
        except ValidationError as e:
            return EvaluationResult(success=False, error=str(e))
        except FileNotFoundError as e:
            return EvaluationResult(success=False, error=f"File not found: {e}")
        except Exception as e:
            return EvaluationResult(success=False, error=f"Evaluation failed: {e}")

    def _load_metadata(self, metadata_path: str) -> dict:
        """Load metadata from file. .json = plain, .txt = encrypted."""
        path = Path(metadata_path)
        if not path.exists():
            raise FileNotFoundError(metadata_path)

        with open(path, "r", encoding="utf-8") as f:
            content = f.read().strip()

        if path.suffix.lower() == ".json":
            try:
                return json.loads(content)
            except json.JSONDecodeError as e:
                raise ValidationError(f"Invalid JSON in metadata file: {e}") from e

        if not self._encryption_key:
            raise DecryptionError(
                "BMDE_ENCRYPTION_KEY environment variable is not set. "
                "Set it to decrypt .txt metadata files."
            )
        prev = os.environ.get("BMDE_ENCRYPTION_KEY")
        os.environ["BMDE_ENCRYPTION_KEY"] = self._encryption_key
        try:
            decrypted = self._core.decrypt_string(content)
            return json.loads(decrypted)
        finally:
            if prev is not None:
                os.environ["BMDE_ENCRYPTION_KEY"] = prev
            elif "BMDE_ENCRYPTION_KEY" in os.environ:
                del os.environ["BMDE_ENCRYPTION_KEY"]

    def _load_design(self, design_path: str) -> Tuple[str, bool]:
        """Load design file. Returns (content, is_pdb). Supports GenBank, FASTA (.fasta, .fa), and PDB."""
        path = Path(design_path)
        if not path.exists():
            raise FileNotFoundError(design_path)

        with open(path, "r", encoding="utf-8") as f:
            content = f.read()

        suffix = path.suffix.lower()
        if suffix == ".pdb":
            return content, True

        if suffix in (".fasta", ".fa", ".faa", ".fna"):
            record = SeqIO.read(StringIO(content), "fasta")
            record.annotations["molecule_type"] = "DNA"
            genbank_str_io = StringIO()
            SeqIO.write(record, genbank_str_io, "genbank")
            return genbank_str_io.getvalue(), False

        # GenBank (.gb, .gbk, etc.)
        record = SeqIO.read(StringIO(content), "genbank")
        genbank_str_io = StringIO()
        SeqIO.write(record, genbank_str_io, "genbank")
        return genbank_str_io.getvalue(), False

    def _verify_checksum(self, design_content: str, metadata_json: dict, is_pdb: bool) -> None:
        """Verify design checksum matches metadata. Raises ChecksumMismatchError on failure."""
        stored = metadata_json.get("designChecksum")
        if not stored:
            raise ValidationError("Metadata missing designChecksum")

        if is_pdb:
            computed = self._core.calculate_checksum(design_content)
        else:
            record = SeqIO.read(StringIO(design_content), "genbank")
            computed = self._core.calculate_checksum(str(record.seq))

        if computed != stored:
            raise ChecksumMismatchError(
                "Design file and metadata file do not match. "
                "The design file may have been modified after the metadata was generated."
            )

    def _compute_revisions(self, design_content: str, metadata_json: dict, is_pdb: bool) -> list:
        """Compute revision history from changelog."""
        changelog = metadata_json.get("changelog", [])
        return self._core.compute_revisions(last_design=design_content, changelog=changelog)

    def _build_summary(
        self,
        metadata_json: dict,
        revisions: list,
        rule_stats: dict,
        rules: list,
        final_rec_config: dict,
    ) -> EvaluationSummary:
        """Build evaluation summary."""
        op_counts: dict = {}
        for r in revisions:
            code = r.get("operationCode", "")
            op_counts[code] = op_counts.get(code, 0) + 1

        flagged = sum(1 for r in revisions if r.get("status") in FLAGGED_STATUSES)
        auto_screening_recommended = sum(1 for r in revisions if r.get("auto_screening_recommended", False))

        date_range = None
        timestamps = [r.get("timestamp") for r in revisions if r.get("timestamp")]
        if timestamps:
            parsed = [_parse_timestamp(t) for t in timestamps]
            parsed = [p for p in parsed if p is not None]
            if parsed:
                min_ts = min(parsed)
                max_ts = max(parsed)
                date_range = {
                    "earliest": min_ts.isoformat() if hasattr(min_ts, "isoformat") else str(min_ts),
                    "latest": max_ts.isoformat() if hasattr(max_ts, "isoformat") else str(max_ts),
                }

        enabled = [r for r in rules if r.get("enabled")]
        applied_rules = [
            {
                "name": r.get("name", ""),
                "flaggedCount": rule_stats.get(r.get("id", ""), 0),
                "autoScreen": r.get("autoScreen", False),
            }
            for r in enabled
        ]

        screening_statuses: List[Optional[str]] = []  # no screening data at evaluate time
        final_rec = compute_final_recommendation(
            total_revisions=len(revisions),
            flagged_count=flagged,
            screening_statuses=screening_statuses,
            final_rec_config=final_rec_config,
        )

        return EvaluationSummary(
            design_name=metadata_json.get("designName", "Unknown"),
            author=metadata_json.get("author", "Unknown"),
            total_revisions=len(revisions),
            operation_counts=op_counts,
            flagged_count=flagged,
            auto_screening_recommended_count=auto_screening_recommended,
            date_range=date_range,
            rule_stats=rule_stats,
            applied_rules=applied_rules,
            final_recommendation=final_rec,
        )

    def export_for_viewer(self, result: EvaluationResult, path: str) -> None:
        """Write evaluation result to JSON file for use by the webapp viewer."""
        with open(path, "w", encoding="utf-8") as f:
            f.write(result.to_json())

    def update_results_with_screening(
        self,
        result: EvaluationResult,
        screening_results: Union[Dict, str],
        results_path: Optional[str] = None,
    ) -> EvaluationResult:
        """
        Update evaluation result with screening outcomes for sequences from the FASTA.

        Maps screening results (keyed by FASTA IDs like `{design_name}_rev{revision}`)
        back to revisions and updates screening_status and adds a screening comment
        with reason codes.

        Screening result schema per sequence:
        - regulatory_status: 'controlled' | 'not_controlled' | 'needs_investigation'
        - findings.us_ccl_export_control.reason_code
        - findings.eu_dual_use_export_control.reason_code
        - findings.us_screening_framework.reason_code

        Args:
            result: The evaluation result to update (use EvaluationResult.from_file()
                to load from results.json if needed).
            screening_results: Dict or JSON string keyed by FASTA IDs, values follow
                the screening schema above.
            results_path: If provided, save the updated result to this path.

        Returns:
            The updated EvaluationResult (mutates the provided result in place).
        """
        if isinstance(screening_results, str):
            screening_results = json.loads(screening_results)

        design_name = result.design_name or ""
        rev_by_num = {rev.revision: rev for rev in result.revisions}

        for fasta_id, sr in screening_results.items():
            if not isinstance(sr, dict):
                continue

            fasta_id_clean = fasta_id.strip()
            if fasta_id_clean == design_name:
                if result.summary is not None:
                    regulatory_status = sr.get("regulatory_status")
                    if regulatory_status:
                        result.summary.design_screening_status = regulatory_status
                    reasons = _build_screening_reason_comment(sr)
                    if reasons:
                        result.summary.design_screening_comment = f"Screening: {reasons}"
                continue

            # _revN key: update the revision
            match = re.search(r"_rev(\d+)$", fasta_id_clean)
            if not match:
                continue
            rev_num = int(match.group(1))
            rev = rev_by_num.get(rev_num)
            if not rev:
                continue

            regulatory_status = sr.get("regulatory_status")
            if regulatory_status:
                rev.screening_status = regulatory_status

            reasons = _build_screening_reason_comment(sr)
            if reasons:
                rev.comments = list(rev.comments)
                rev.comments.append({
                    "timestamp": datetime.now().strftime("%m/%d/%Y, %H:%M:%S"),
                    "text": f"Screening: {reasons}",
                })

        _, final_rec_config = load_rules_config(self._rules_config_path)
        failed_keywords = final_rec_config.get("failedScreeningKeywords") or []

        for rev in result.revisions:
            rev.status = compute_revision_status(
                rev.status, rev.screening_status, failed_keywords
            )

        if result.summary is not None:
            counts: Dict[str, int] = {}
            for rev in result.revisions:
                if rev.screening_status is not None:
                    counts[rev.screening_status] = counts.get(rev.screening_status, 0) + 1
            result.summary.screening_status_counts = counts

            result.summary.flagged_count = sum(
                1 for rev in result.revisions if rev.status in FLAGGED_STATUSES
            )
            screening_statuses = [rev.screening_status for rev in result.revisions]
            result.summary.final_recommendation = compute_final_recommendation(
                total_revisions=len(result.revisions),
                flagged_count=result.summary.flagged_count,
                screening_statuses=screening_statuses,
                final_rec_config=final_rec_config,
            )

        if results_path:
            with open(results_path, "w", encoding="utf-8") as f:
                f.write(result.to_json())

        return result

    def update_revision_manually(
        self,
        result: EvaluationResult,
        revision_number: int,
        status: Optional[str] = None,
        comment: Optional[str] = None,
        results_path: Optional[str] = None,
    ) -> EvaluationResult:
        """
        Manually update a revision's status and/or add a custom comment.

        Args:
            result: The evaluation result to update.
            revision_number: The revision number to update.
            status: If provided, must be 'marked_safe' or 'marked_unsafe'. Adds a comment
                recording the status change.
            comment: If provided, adds this as a custom comment.
            results_path: If provided, save the updated result to this path.

        Returns:
            The updated EvaluationResult (mutates in place).
        """
        rev = next((r for r in result.revisions if r.revision == revision_number), None)
        if not rev:
            return result

        ts = datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
        rev.comments = list(rev.comments)

        if status is not None:
            if status not in ("marked_safe", "marked_unsafe"):
                raise ValueError(
                    f"status must be 'marked_safe' or 'marked_unsafe', got {status!r}"
                )
            prev_status = rev.status
            rev.status = status
            rev.comments.append({
                "timestamp": ts,
                "text": f"Status manually changed from {prev_status!r} to {status!r}",
            })

        if comment:
            rev.comments.append({"timestamp": ts, "text": comment})

        if result.summary is not None:
            result.summary.flagged_count = sum(
                1 for r in result.revisions if r.status in FLAGGED_STATUSES
            )

        if results_path:
            with open(results_path, "w", encoding="utf-8") as f:
                f.write(result.to_json())

        return result

    def save_to_output_folder(
        self,
        result: EvaluationResult,
        design_path: str,
        metadata_path: str,
        output_dir: Optional[str] = None,
    ) -> str:
        """
        Save evaluation outputs to a timestamped folder.

        Creates a subfolder like {output_dir}/2025-02-25_14-30-00/ containing:
        - Design file (copy, same filename as input)
        - Metadata JSON (same base name as input metadata, .json extension)
        - Encrypted metadata (only if input was .txt; same filename as input)
        - results.json (evaluation result)
        - sequences_for_screening.fasta (always produced; includes submitted design at minimum,
          plus any revisions flagged for auto-screening)

        Uses BMDE_OUTPUT_DIR env var if output_dir is not provided.

        Returns:
            Path to the created timestamped output folder.
        """
        base = output_dir or os.getenv("BMDE_OUTPUT_DIR") or "."
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        out_folder = Path(base) / timestamp
        out_folder.mkdir(parents=True, exist_ok=True)

        design_path_obj = Path(design_path)
        metadata_path_obj = Path(metadata_path)
        design_ext = design_path_obj.suffix or ".gb"
        design_name = result.design_name or design_path_obj.stem or "design"
        design_filename = design_path_obj.name
        metadata_filename = metadata_path_obj.name

        # Copy original design file (preserve input filename)
        shutil.copy2(design_path, out_folder / design_filename)

        # Metadata JSON (unencrypted) - use input metadata base name + .json
        if result.metadata_json:
            metadata_json_name = metadata_path_obj.stem + ".json" if metadata_path_obj.suffix.lower() == ".txt" else metadata_filename
            with open(out_folder / metadata_json_name, "w", encoding="utf-8") as f:
                json.dump(result.metadata_json, f, indent=2)

        # Metadata encrypted: only if input was encrypted (.txt); use same filename as input
        if metadata_path_obj.suffix.lower() == ".txt":
            with open(metadata_path, "r", encoding="utf-8") as f:
                raw_content = f.read().strip()
            with open(out_folder / metadata_filename, "w", encoding="utf-8") as f:
                f.write(raw_content)

        # Results JSON
        with open(out_folder / "results.json", "w", encoding="utf-8") as f:
            f.write(result.to_json())

        # FASTA for biosecurity screening: always generated with at least the final design.
        # Order: flagged revisions first (if any), then the final design at the end.
        is_pdb = design_ext.lower() == ".pdb"
        seen_sequences: Set[str] = set()
        fasta_entries: List[Tuple[str, str]] = []

        # Add any revisions flagged for auto-screening first (avoid duplicates)
        for rev in result.revisions:
            if not rev.auto_screening_recommended:
                continue
            seq = _extract_sequence_from_design(rev.design, is_pdb)
            if seq and seq not in seen_sequences:
                seen_sequences.add(seq)
                rev_id = f"{design_name}_rev{rev.revision}"
                fasta_entries.append((rev_id, seq))

        # Always add the final design at the end (tagged with design name)
        if result.revisions:
            current_rev = max(result.revisions, key=lambda r: r.revision)
            seq = _extract_sequence_from_design(current_rev.design, is_pdb)
            if seq and seq not in seen_sequences:
                seen_sequences.add(seq)
                fasta_entries.append((design_name, seq))

        with open(out_folder / "sequences_for_screening.fasta", "w", encoding="utf-8") as f:
            for seq_id, seq in fasta_entries:
                f.write(f">{seq_id}\n")
                f.write(_format_fasta_sequence(seq) + "\n")

        return str(out_folder)


def _get_nested(d: dict, path: str):
    """Get nested value from dict by dotted path (e.g. 'findings.us_ccl_export_control.reason_code')."""
    val = d
    for key in path.split("."):
        val = (val or {}).get(key)
    return val


def _build_screening_reason_comment(sr: dict) -> str:
    """Build a comment string from screening result reason codes."""
    parts = []
    for label, path in [
        ("US CCL export control", "findings.us_ccl_export_control.reason_code"),
        ("EU dual-use export control", "findings.eu_dual_use_export_control.reason_code"),
        ("US screening framework", "findings.us_screening_framework.reason_code"),
    ]:
        code = _get_nested(sr, path)
        if code:
            parts.append(f"{label}: {code}")
    return "; ".join(parts) if parts else ""


def _extract_sequence_from_design(design_content: str, is_pdb: bool) -> Optional[str]:
    """Extract sequence string from design content (GenBank, FASTA, or PDB)."""
    try:
        if is_pdb:
            from Bio.PDB import PDBParser
            from Bio.SeqUtils import seq1

            parser = PDBParser(QUIET=True)
            with tempfile.NamedTemporaryFile(mode="w", suffix=".pdb", delete=False) as tmp:
                tmp.write(design_content)
                tmp_path = tmp.name
            try:
                struct = parser.get_structure("pdb", tmp_path)
                residues = []
                for model in struct:
                    for chain in model:
                        for residue in chain:
                            if residue.id[0] == " ":
                                residues.append(residue.get_resname())
                if not residues:
                    return None
                return seq1(" ".join(residues))
            finally:
                os.unlink(tmp_path)
        else:
            # GenBank or already-converted-from-FASTA (GenBank)
            try:
                record = SeqIO.read(StringIO(design_content), "genbank")
            except Exception:
                record = SeqIO.read(StringIO(design_content), "fasta")
            return str(record.seq)
    except Exception:
        return None


def _format_fasta_sequence(seq: str, line_length: int = 80) -> str:
    """Format sequence for FASTA (wrap at line_length)."""
    lines = []
    for i in range(0, len(seq), line_length):
        lines.append(seq[i : i + line_length])
    return "\n".join(lines)
