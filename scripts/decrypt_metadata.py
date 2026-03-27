#!/usr/bin/env python3
"""
Decrypt encrypted metadata files (.txt) to JSON using the biodesign-metadata library.

Recursively processes metadata files in a folder or a single file. Uses one decryption
key for all files. Outputs decrypted JSON to a predefined folder, preserving directory
structure when processing recursively.

Usage:
    python decrypt_metadata.py <path> --key <decryption_key> [--output <output_dir>]
    python decrypt_metadata.py samples/ --key my_secret_key
    python decrypt_metadata.py samples/sequence_obfuscation/metadata_0.txt --key my_secret_key

Example:
    python decrypt_metadata.py samples/ --key my_key -o decrypted_output/
"""

import argparse
import json
import os
import sys
from pathlib import Path

# Add biodesign-library to path if not installed
_script_dir = Path(__file__).resolve().parent
_project_root = _script_dir.parent
_biodesign_path = _project_root / "biodesign-library" / "python"
if _biodesign_path.exists() and str(_biodesign_path) not in sys.path:
    sys.path.insert(0, str(_biodesign_path))

from biodesign_metadata.core import BioDesignMetadataLibrary
from biodesign_metadata.exceptions import DecryptionError

# Predefined output folder (can be overridden with --output)
DEFAULT_OUTPUT_DIR = "decrypted_metadata"


def find_metadata_files(path: Path) -> list[Path]:
    """Collect .txt files from path (recursive if directory, single file if file)."""
    if path.is_file():
        if path.suffix.lower() == ".txt":
            return [path]
        return []
    if path.is_dir():
        return sorted(path.rglob("*.txt"))
    return []


def decrypt_and_write(
    input_path: Path,
    output_dir: Path,
    lib: BioDesignMetadataLibrary,
    base_path: Path,
) -> bool:
    """Decrypt a single metadata file and write to output_dir. Returns True on success."""
    try:
        with open(input_path, "r", encoding="utf-8") as f:
            content = f.read().strip()
    except Exception as e:
        print(f"  Error reading {input_path}: {e}", file=sys.stderr)
        return False

    try:
        decrypted = lib.decrypt_string(content)
    except DecryptionError as e:
        print(f"  Skip {input_path}: {e}", file=sys.stderr)
        return False

    # Validate decrypted content is JSON
    try:
        data = json.loads(decrypted)
    except json.JSONDecodeError as e:
        print(f"  Skip {input_path}: decrypted content is not valid JSON: {e}", file=sys.stderr)
        return False

    # Preserve relative structure: output_dir / relative_path_to_file (with .json)
    try:
        rel = input_path.resolve().relative_to(base_path.resolve())
    except ValueError:
        rel = input_path.name
    out_path = output_dir / rel.with_suffix(".json")
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    print(f"  {input_path} -> {out_path}")
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Decrypt encrypted metadata .txt files to JSON"
    )
    parser.add_argument(
        "path",
        type=str,
        help="Path to a folder (processed recursively) or a single .txt metadata file",
    )
    parser.add_argument(
        "-k", "--key",
        type=str,
        required=True,
        help="Decryption key (used for all files)",
    )
    parser.add_argument(
        "-o", "--output",
        type=str,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Output directory (default: {DEFAULT_OUTPUT_DIR})",
    )
    args = parser.parse_args()

    path = Path(args.path)
    if not path.exists():
        print(f"Error: path does not exist: {path}", file=sys.stderr)
        sys.exit(1)

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    files = find_metadata_files(path)
    if not files:
        print(f"No .txt metadata files found under {path}", file=sys.stderr)
        sys.exit(1)

    # Set env so core.decrypt_string uses our key
    os.environ["BMDE_ENCRYPTION_KEY"] = args.key
    lib = BioDesignMetadataLibrary()

    base_path = path if path.is_dir() else path.parent
    success = 0
    for f in files:
        if decrypt_and_write(f, output_dir, lib, base_path):
            success += 1

    print(f"\nDecrypted {success}/{len(files)} files to {output_dir}")


if __name__ == "__main__":
    main()
