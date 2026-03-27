"""
Core BMDE library - metadata creation, encryption, checksum, and revision computation.
"""

import base64
import datetime
import hashlib
import json
import os
import uuid
from dataclasses import asdict, dataclass, field
from typing import Dict, List, Optional

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from dotenv import load_dotenv

from biodesign_metadata.exceptions import DecryptionError

load_dotenv()  # Loads .env from current working directory (where the script is run)


@dataclass
class BioDesignOperation:
    """Represents a single operation performed on a biological design."""

    operationCode: str
    operationDetails: dict
    change: str
    timestamp: str
    tool: str
    comments: List[Dict[str, str]] = field(default_factory=list)
    status: str = ""


@dataclass
class BioDesignMetadata:
    """Represents the metadata associated with a biological design."""

    id: str
    parentMetadataId: Optional[str]
    designName: Optional[str]
    designChecksum: str
    author: str
    description: str
    lastUpdated: str
    changelog: List = field(default_factory=list)


class BioDesignMetadataLibrary:
    """
    Main class for managing biological design metadata.
    Provides creation, encryption, checksum, and revision computation.
    """

    def create_metadata(
        self,
        parent_metadata_id: Optional[str],
        design_name: str,
        author: str,
        description: str,
        design: str,
    ):
        """Create new metadata for a biological design."""
        design_checksum = self.calculate_checksum(design)
        metadata = BioDesignMetadata(
            id=str(uuid.uuid4()),
            parentMetadataId=parent_metadata_id,
            designName=design_name,
            designChecksum=design_checksum,
            author=author,
            description=description,
            lastUpdated=datetime.datetime.now().strftime("%m/%d/%Y, %H:%M:%S"),
            changelog=[],
        )
        json_string = json.dumps(asdict(metadata), indent=4)
        with open(f"library/metadata_{design_name}.json", "w") as f:
            f.write(json_string)
        return metadata

    def update_metadata_with_operation(
        self,
        metadata_path: str,
        design: str,
        operation_code: str,
        operation_details: Dict,
        change: str,
        comments: Optional[List[Dict[str, str]]] = None,
        status: str = "",
    ):
        """Update existing metadata with a new operation."""
        with open(metadata_path, "r") as f:
            metadata_json = json.load(f)
            if "changelog" in metadata_json:
                for operation in metadata_json["changelog"]:
                    if "comments" not in operation:
                        operation["comments"] = []
                    if "status" not in operation:
                        operation["status"] = ""
            metadata = BioDesignMetadata(**metadata_json)
            metadata.lastUpdated = datetime.datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
            metadata.designChecksum = self.calculate_checksum(design)
            operation = BioDesignOperation(
                operationCode=operation_code,
                operationDetails=operation_details,
                change=change,
                timestamp=metadata.lastUpdated,
                tool="BioDesign tool",
                comments=comments if comments is not None else [],
                status=status if status else "",
            )
            metadata.changelog.append(operation)
            json_string = json.dumps(asdict(metadata), indent=4)
        with open(metadata_path, "w") as f:
            f.write(json_string)
        return metadata

    @staticmethod
    def calculate_checksum(input_str: str) -> str:
        """Calculate SHA-256 checksum of a string (case-insensitive)."""
        input_str = input_str.lower()
        hash_func = hashlib.sha256()
        hash_func.update(input_str.encode())
        return hash_func.hexdigest()

    @staticmethod
    def compute_difference(original_string: str, new_string: str) -> str:
        """Compute the difference between two strings using diff_match_patch."""
        from diff_match_patch import diff_match_patch

        dmp = diff_match_patch()
        patches = dmp.patch_make(new_string, original_string)
        return dmp.patch_toText(patches)

    @staticmethod
    def compute_revisions(last_design: str, changelog: List[dict]) -> List[dict]:
        """Compute all revisions of a design from its changelog."""
        from diff_match_patch import diff_match_patch

        dmp = diff_match_patch()
        current_revision = len(changelog)
        revisions = []
        changelog_reversed = changelog[::-1]
        for operation in changelog_reversed:
            if "comments" not in operation:
                operation["comments"] = []
            if "status" not in operation:
                operation["status"] = ""
            op = BioDesignOperation(**operation)
            revisions.append({"revision": current_revision, "design": last_design, **asdict(op)})
            if op.change:
                patches = dmp.patch_fromText(op.change)
                last_design, _ = dmp.patch_apply(patches, last_design)
            current_revision -= 1
        return revisions

    @staticmethod
    def decrypt_string(encrypted_base64_string: str) -> str:
        """Decrypt an encrypted string using AES-CBC. Raises DecryptionError on failure."""
        encryption_key = os.getenv("BMDE_ENCRYPTION_KEY")
        if not encryption_key:
            raise DecryptionError(
                "BMDE_ENCRYPTION_KEY environment variable is not set. "
                "Please set it to decrypt metadata files."
            )
        try:
            key = encryption_key.encode("utf-8")
            encrypted_data_with_iv = base64.b64decode(encrypted_base64_string)
            iv = encrypted_data_with_iv[:16]
            encrypted_data = encrypted_data_with_iv[16:]

            cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
            decryptor = cipher.decryptor()
            original_data = decryptor.update(encrypted_data) + decryptor.finalize()

            unpadder = padding.PKCS7(algorithms.AES.block_size).unpadder()
            unpadded_data = unpadder.update(original_data) + unpadder.finalize()
            return unpadded_data.decode("utf-8")
        except Exception as e:
            raise DecryptionError(
                f"Failed to decrypt metadata. The encryption key may be incorrect or the data may be corrupted. {e}"
            ) from e

    @staticmethod
    def encrypt_string(string_to_encrypt: str) -> str:
        """Encrypt a string using AES-CBC. Requires BMDE_ENCRYPTION_KEY environment variable."""
        encryption_key = os.getenv("BMDE_ENCRYPTION_KEY")
        if not encryption_key:
            raise DecryptionError("BMDE_ENCRYPTION_KEY environment variable is not set.")
        key = encryption_key.encode("utf-8")
        iv = os.urandom(16)
        cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
        encryptor = cipher.encryptor()
        padder = padding.PKCS7(128).padder()
        padded_data = padder.update(string_to_encrypt.encode()) + padder.finalize()
        encrypted = encryptor.update(padded_data) + encryptor.finalize()
        return base64.b64encode(iv + encrypted).decode()
