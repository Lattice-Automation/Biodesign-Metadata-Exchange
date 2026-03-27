#!/usr/bin/env python3
"""
Create an unencrypted metadata JSON file from a FASTA file.

Uses the biodesign-metadata library to build metadata with a few trivial
operations (CREATE, APPEND, IMPORT). The resulting metadata can be used with
the evaluator or provider UI alongside the original FASTA.

Usage:
    python create_metadata_from_fasta.py <fasta_path> [--output <metadata_path>]
    python create_metadata_from_fasta.py samples/sample_seq.fasta

Example:
    python create_metadata_from_fasta.py samples/sample_seq.fasta -o metadata_sample_seq.json
"""

import argparse
import json
import sys
from pathlib import Path

# Add biodesign-library to path if not installed
_biodesign_path = Path(__file__).resolve().parent / "biodesign-library" / "python"
if _biodesign_path.exists() and str(_biodesign_path) not in sys.path:
    sys.path.insert(0, str(_biodesign_path.parent))

from Bio import SeqIO
from io import StringIO

from biodesign_metadata.core import BioDesignMetadataLibrary
from biodesign_metadata.core import BioDesignMetadata
from biodesign_metadata.core import BioDesignOperation
from dataclasses import asdict
import datetime
import uuid


def sequence_to_minimal_genbank(seq: str, seq_id: str = "sequence") -> str:
    """Create minimal GenBank from a plain sequence string."""
    from Bio.Seq import Seq
    from Bio.SeqRecord import SeqRecord

    record = SeqRecord(Seq(seq.lower()), id=seq_id, description="")
    record.annotations["molecule_type"] = "DNA"
    buf = StringIO()
    SeqIO.write(record, buf, "genbank")
    return buf.getvalue()


def main():
    parser = argparse.ArgumentParser(description="Create metadata JSON from a FASTA file")
    parser.add_argument("fasta_path", type=str, help="Path to the FASTA file")
    parser.add_argument("-o", "--output", type=str, help="Output metadata path (default: metadata_<design_name>.json)")
    parser.add_argument("--author", type=str, default="Sample script", help="Author for metadata")
    parser.add_argument("--description", type=str, default="", help="Design description")
    args = parser.parse_args()

    fasta_path = Path(args.fasta_path)
    if not fasta_path.exists():
        print(f"Error: FASTA file not found: {fasta_path}", file=sys.stderr)
        sys.exit(1)

    # Design name from filename (without extension)
    design_name = fasta_path.stem
    if design_name.lower().endswith((".fa", ".fna", ".faa")):
        design_name = Path(design_name).stem

    # Load FASTA and extract sequence
    with open(fasta_path, "r", encoding="utf-8") as f:
        fasta_content = f.read()

    record = SeqIO.read(StringIO(fasta_content), "fasta")
    full_seq = str(record.seq).lower()
    seq_id = record.id or design_name

    # Convert full FASTA to GenBank (current design)
    full_genbank = sequence_to_minimal_genbank(full_seq, seq_id)

    # Trivial operations: simulate CREATE -> APPEND -> IMPORT
    # Rev 1: initial sequence (first 70% of full)
    # Rev 2: after APPEND (add next 15%)
    # Rev 3: after APPEND (add remaining 15%) = full design

    n = len(full_seq)
    if n < 10:
        # Very short sequence: single revision
        seq_v1 = full_seq
        seq_v2 = full_seq
    else:
        split1 = max(1, int(n * 0.7))
        split2 = max(split1 + 1, int(n * 0.85))
        seq_v1 = full_seq[:split1]
        seq_v2 = full_seq[:split2]

    gb_v1 = sequence_to_minimal_genbank(seq_v1, seq_id)
    gb_v2 = sequence_to_minimal_genbank(seq_v2, seq_id) if seq_v2 != seq_v1 else gb_v1

    lib = BioDesignMetadataLibrary()
    now = datetime.datetime.now().strftime("%m/%d/%Y, %H:%M:%S")

    # Build changelog (oldest first). Each "change" is diff(older_design, newer_design)
    # so that applying it to newer yields older.
    changelog = []

    # Op 1: CREATE (empty change = no prior design)
    changelog.append(BioDesignOperation(
        operationCode="CREATE",
        operationDetails={"sequence_length": len(seq_v1)},
        change="",
        timestamp=now,
        tool="create_metadata_from_fasta",
        comments=[],
        status="",
    ))

    if seq_v2 != seq_v1:
        # Op 2: APPEND (split1/split2 from above when n >= 10)
        diff_append = lib.compute_difference(gb_v1, gb_v2)
        appended = seq_v2[len(seq_v1):]  # the part we "appended"
        changelog.append(BioDesignOperation(
            operationCode="APPEND",
            operationDetails={"insert_sequence": appended},
            change=diff_append,
            timestamp=now,
            tool="create_metadata_from_fasta",
            comments=[],
            status="",
        ))

    if full_seq != seq_v2:
        # Op 3: APPEND (remaining)
        diff_final = lib.compute_difference(gb_v2, full_genbank)
        appended = full_seq[len(seq_v2):]
        changelog.append(BioDesignOperation(
            operationCode="APPEND",
            operationDetails={"insert_sequence": appended},
            change=diff_final,
            timestamp=now,
            tool="create_metadata_from_fasta",
            comments=[],
            status="",
        ))

    metadata = BioDesignMetadata(
        id=str(uuid.uuid4()),
        parentMetadataId=None,
        designName=design_name,
        designChecksum=lib.calculate_checksum(full_seq),
        author=args.author,
        description=args.description,
        lastUpdated=now,
        changelog=[asdict(op) for op in changelog],
    )

    output_path = args.output or f"metadata_{design_name}.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(asdict(metadata), f, indent=2)

    print(f"Created unencrypted metadata: {output_path}")
    print(f"  Design: {design_name}")
    print(f"  Revisions: {len(changelog)}")


if __name__ == "__main__":
    main()
