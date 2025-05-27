"""
BioDesign Metadata Library - Python Implementation

This module provides functionality for managing metadata associated with biological designs.
It includes operations for creating, updating, and tracking changes to biological sequences
and their associated metadata. The library supports encryption, checksum calculation,
and difference tracking between versions.

Key Features:
- Metadata creation and management
- Cryptographic operations (encryption/decryption)
- Checksum calculation for sequence verification
- Difference tracking between versions
- Changelog management
"""

import datetime
import hashlib
import uuid
from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict
from cryptography.hazmat.primitives import padding
from diff_match_patch import diff_match_patch
import json
import base64
import os
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

@dataclass
class BioDesignOperation:
    """
    Represents a single operation performed on a biological design.
    
    Attributes:
        operationCode (str): Unique identifier for the operation type
        operationDetails (dict): Specific details of the operation
        change (str): Description of the change made
        timestamp (str): When the operation was performed
        tool (str): Tool used to perform the operation
    """
    operationCode: str
    operationDetails: dict
    change: str
    timestamp: str
    tool: str

@dataclass
class BioDesignMetadata:
    """
    Represents the metadata associated with a biological design.
    
    Attributes:
        id (str): Unique identifier for the design
        parentMetadataId (Optional[str]): ID of the parent design if derived
        designName (Optional[str]): Name of the design
        designChecksum (str): SHA-256 hash of the design sequence
        author (str): Creator of the design
        description (str): Description of the design
        lastUpdated (str): Timestamp of last modification
        changelog (List[BioDesignOperation]): History of operations performed
    """
    id: str
    parentMetadataId: Optional[str]
    designName: Optional[str]
    designChecksum: str
    author: str
    description: str
    lastUpdated: str
    changelog: List[BioDesignOperation] = field(default_factory=list)


class BioDesignMetadataLibrary:
    """
    Main class for managing biological design metadata.
    
    This class provides methods for creating and updating metadata,
    calculating checksums, tracking changes, and handling encryption.
    All operations are persisted to JSON files in the library directory.
    """

    def create_metadata(self, parent_metadata_id: Optional[str], design_name: str, author: str,
                        description: str, design: str):
        """
        Create new metadata for a biological design.
        
        Args:
            parent_metadata_id: ID of parent design if derived
            design_name: Name of the design
            author: Creator of the design
            description: Description of the design
            design: The actual design sequence
            
        Returns:
            BioDesignMetadata: The created metadata object
            
        Note:
            Creates a new JSON file in the library directory
        """
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

    def update_metadata_with_operation(self, metadata_path: str, design: str, operation_code: str,
                                       operation_details: Dict, change: str):
        """
        Update existing metadata with a new operation.
        
        Args:
            metadata_path: Path to the metadata file
            design: Updated design sequence
            operation_code: Type of operation performed
            operation_details: Specific details of the operation
            change: Description of the change
            
        Returns:
            BioDesignMetadata: The updated metadata object
            
        Note:
            Updates the existing JSON file with new operation and checksum
        """
        with open(metadata_path, "r") as f:
            metadata_json = json.load(f)
            metadata = BioDesignMetadata(**metadata_json)
            metadata.lastUpdated = datetime.datetime.now().strftime("%m/%d/%Y, %H:%M:%S")
            metadata.designChecksum = self.calculate_checksum(design)
            operation = BioDesignOperation(
                operationCode=operation_code,
                operationDetails=operation_details,
                change=change,
                timestamp=metadata.lastUpdated,
                tool="BioDesign tool"
            )
            metadata.changelog.append(operation)
            json_string = json.dumps(asdict(metadata), indent=4)
        with open(metadata_path, "w") as f:
            f.write(json_string)
        return metadata

    # For simplicity, calculating checksum of the string directly (i.e.: the  sequence)
    @staticmethod
    def calculate_checksum(input):
        """
        Calculate SHA-256 checksum of a string.
        
        Args:
            input: String to calculate checksum for
            
        Returns:
            str: Hexadecimal representation of the SHA-256 hash
            
        Note:
            Input is converted to lowercase before hashing
        """
        # Make it case-insensitive
        input = input.lower()
        hash_func = hashlib.sha256()
        hash_func.update(input.encode())
        return hash_func.hexdigest()

    @staticmethod
    def compute_difference(original_string: str, new_string: str):
        """
        Compute the difference between two strings.
        
        Args:
            original_string: Original version
            new_string: New version
            
        Returns:
            str: Text representation of the differences
            
        Note:
            Uses diff_match_patch algorithm for difference computation
        """
        dmp = diff_match_patch()
        patches = dmp.patch_make(new_string, original_string)
        diff = dmp.patch_toText(patches)
        return diff

    @staticmethod
    def compute_revisions(last_design: str, changelog: List[dict]):
        """
        Compute all revisions of a design from its changelog.
        
        Args:
            last_design: Most recent version of the design
            changelog: List of operations performed
            
        Returns:
            List[dict]: List of revisions with their associated operations
            
        Note:
            Applies operations in reverse order to reconstruct history
        """
        dmp = diff_match_patch()

        current_revision = len(changelog)
        revisions = []
        # Reverse changelog so we apply the last modification first
        changelog = changelog[::-1]
        for operation in changelog:
            op = BioDesignOperation(**operation)
            revisions.append({"revision": current_revision, "design": last_design, **asdict(op)})
            if op.change:
                patches = dmp.patch_fromText(op.change)
                last_design, result = dmp.patch_apply(patches, last_design)
            current_revision -= 1
        return revisions

    @staticmethod
    def decrypt_string(encrypted_base64_string):
        """
        Decrypt an encrypted string using AES-CBC.
        
        Args:
            encrypted_base64_string: Base64-encoded encrypted string
            
        Returns:
            str: Decrypted string
            
        Raises:
            ValueError: If encryption key is not set
            
        Note:
            Uses AES-CBC with PKCS7 padding
            Requires ENCRYPTION_KEY environment variable
        """
        # Get encryption key from environment variable
        encryption_key = os.getenv('ENCRYPTION_KEY')
        if not encryption_key:
            raise ValueError("ENCRYPTION_KEY environment variable is not set")

        # Convert the encryption key to bytes
        key = encryption_key.encode('utf-8')

        # Decode the base64 string
        encrypted_data_with_iv = base64.b64decode(encrypted_base64_string)

        # Extract the first 16 bytes for the IV
        iv = encrypted_data_with_iv[:16]

        # Extract the rest of the bytes for the encrypted message
        encrypted_data = encrypted_data_with_iv[16:]

        # Initialize the cipher for decryption
        cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
        decryptor = cipher.decryptor()

        # Decrypt the data
        original_data = decryptor.update(encrypted_data) + decryptor.finalize()

        # Remove padding
        unpadder = padding.PKCS7(algorithms.AES.block_size).unpadder()
        unpadded_data = unpadder.update(original_data) + unpadder.finalize()

        # Return the decrypted string
        return unpadded_data.decode('utf-8')

    @staticmethod
    def encrypt_string(string_to_encrypt: str) -> str:
        """
        Encrypt a string using AES-CBC.
        
        Args:
            string_to_encrypt: String to encrypt
            
        Returns:
            str: Base64-encoded encrypted string
            
        Raises:
            ValueError: If encryption key is not set
            
        Note:
            Uses AES-CBC with PKCS7 padding
            Requires ENCRYPTION_KEY environment variable
        """
        # Get encryption key from environment variable
        encryption_key = os.getenv('ENCRYPTION_KEY')
        if not encryption_key:
            raise ValueError("ENCRYPTION_KEY environment variable is not set")
            
        encryption_key = encryption_key.encode('utf-8')  # Convert to bytes
        iv = os.urandom(16)  # 16 bytes for the IV

        # Create cipher
        cipher = Cipher(algorithms.AES(encryption_key), modes.CBC(iv), backend=default_backend())
        encryptor = cipher.encryptor()

        # Pad string to ensure it's a multiple of block size (AES block size is 128 bits)
        padder = padding.PKCS7(128).padder()
        padded_data = padder.update(string_to_encrypt.encode()) + padder.finalize()

        # Encrypt data
        encrypted = encryptor.update(padded_data) + encryptor.finalize()

        # Combine IV and encrypted message and encode to base64
        encrypted_message = base64.b64encode(iv + encrypted).decode()
        return encrypted_message

