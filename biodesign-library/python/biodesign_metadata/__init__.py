"""
Biodesign Metadata Exchange (BMDE) - Python Package

This package provides tools for evaluating and interpreting biodesign metadata,
including decrypting metadata, verifying checksums, computing revision history,
and applying rules to flag revisions of concern.
"""

from biodesign_metadata.evaluator import MetadataEvaluator
from biodesign_metadata.exceptions import (
    BiodesignMetadataError,
    ChecksumMismatchError,
    DecryptionError,
    ValidationError,
)
from biodesign_metadata.models import EvaluationResult, EvaluationSummary

__all__ = [
    "MetadataEvaluator",
    "EvaluationResult",
    "EvaluationSummary",
    "BiodesignMetadataError",
    "ChecksumMismatchError",
    "DecryptionError",
    "ValidationError",
]
