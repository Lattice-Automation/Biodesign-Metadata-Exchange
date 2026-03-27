"""
Custom exceptions for the biodesign metadata package.
"""


class BiodesignMetadataError(Exception):
    """Base exception for biodesign metadata operations."""

    def __init__(self, message: str = "A biodesign metadata error occurred"):
        self.message = message
        super().__init__(self.message)


class DecryptionError(BiodesignMetadataError):
    """Raised when metadata decryption fails (e.g., wrong key or corrupted data)."""

    def __init__(self, message: str = "Metadata decryption failed"):
        super().__init__(message)


class ChecksumMismatchError(BiodesignMetadataError):
    """Raised when the design file checksum does not match the metadata."""

    def __init__(self, message: str = "Design file and metadata checksum mismatch"):
        super().__init__(message)


class ValidationError(BiodesignMetadataError):
    """Raised when validation fails (e.g., invalid file format or structure)."""

    def __init__(self, message: str = "Validation failed"):
        super().__init__(message)
