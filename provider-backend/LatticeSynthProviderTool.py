"""
Lattice Synthesis Provider Tool

This module provides functionality for validating and processing biological designs
and their associated metadata. It supports both sequence (GenBank) and structure (PDB)
file formats, and includes operations for checksum verification and revision tracking.

Key Features:
- Design and metadata validation
- Checksum verification
- Revision history computation
- Support for multiple file formats (GenBank, PDB)
"""

import json
from io import StringIO
from Bio import SeqIO
from BioDesignMetadataLibrary import BioDesignMetadataLibrary, BioDesignMetadata


class LatticeSynthesisProviderTool:
    """
    Tool for validating and processing biological designs for synthesis.
    
    This class provides methods for verifying the integrity of biological designs
    and their metadata, as well as computing revision histories. It supports both
    sequence-based (GenBank) and structure-based (PDB) designs.
    """

    def __init__(self):
        """
        Initialize the Lattice Synthesis Provider Tool.
        
        Creates an instance of BioDesignMetadataLibrary for handling metadata operations.
        """
        self.biodesign_metadata = BioDesignMetadataLibrary()

    def design_and_metadata_match(self, design_file: str, metadata_file: str):
        """
        Verify that a design file matches its associated metadata.
        
        This method:
        1. Decrypts and loads the metadata file
        2. Calculates the checksum of the design file
        3. Compares the calculated checksum with the one in metadata
        
        Args:
            design_file: Path to the design file (GenBank or PDB)
            metadata_file: Path to the encrypted metadata file
            
        Returns:
            bool: True if the design matches its metadata, False otherwise
            
        Note:
            Supports both GenBank (.gb) and PDB (.pdb) file formats
        """
        with open(metadata_file, "r") as metadata_handle:
            metadata_str = metadata_handle.read()
        decrypted_metadata = self.biodesign_metadata.decrypt_string(metadata_str)
        metadata_json = json.loads(decrypted_metadata)
        metadata = BioDesignMetadata(**metadata_json)
        design_checksum_in_metadata = metadata.designChecksum
        if design_file.endswith(".pdb"):
            with open(design_file, "r") as input_handle:
                design_str = input_handle.read()
            received_design_checksum = self.biodesign_metadata.calculate_checksum(design_str)
        else:
            with open(design_file, "r") as input_handle:
                record = SeqIO.read(input_handle, "genbank")
            received_design_checksum = self.biodesign_metadata.calculate_checksum(str(record.seq))
        return design_checksum_in_metadata == received_design_checksum

    def compute_revisions(self, design_file: str, metadata_file: str):
        """
        Compute the revision history of a design.
        
        This method:
        1. Decrypts and loads the metadata file
        2. Reads the current design file
        3. Computes the revision history using the changelog
        
        Args:
            design_file: Path to the design file (GenBank or PDB)
            metadata_file: Path to the encrypted metadata file
            
        Returns:
            dict: A dictionary containing:
                - id: Design identifier
                - parentMetadataId: Parent design ID if derived
                - designName: Name of the design
                - author: Creator of the design
                - description: Design description
                - lastUpdated: Timestamp of last modification
                - revisions: List of all revisions with their changes
                
        Note:
            Supports both GenBank (.gb) and PDB (.pdb) file formats
        """
        with open(metadata_file, "r") as metadata_handle:
            metadata_str = metadata_handle.read()
        decrypted_metadata = self.biodesign_metadata.decrypt_string(metadata_str)
        metadata_json = json.loads(decrypted_metadata)
        if design_file.endswith(".pdb"):
            with open(design_file, "r") as input_handle:
                design_str = input_handle.read()
            last_design = design_str
        else:
            with open(design_file, "r") as input_handle:
                record = SeqIO.read(input_handle, "genbank")
            last_design = self.get_string_from_record(record)
        revisions = self.biodesign_metadata.compute_revisions(last_design=last_design, changelog=metadata_json['changelog'])
        return {
            "id": metadata_json['id'],
            "parentMetadataId": metadata_json['parentMetadataId'],
            "designName": metadata_json['designName'],
            "author": metadata_json['author'],
            "description": metadata_json['description'],
            "lastUpdated": metadata_json['lastUpdated'],
            "revisions": revisions
        }

    @staticmethod
    def get_string_from_record(record):
        """
        Convert a BioPython SeqRecord to a GenBank format string.
        
        Args:
            record: BioPython SeqRecord object
            
        Returns:
            str: GenBank format string representation of the record
            
        Note:
            Uses StringIO for efficient string conversion
        """
        genbank_str_io = StringIO()
        SeqIO.write(record, genbank_str_io, "genbank")
        genbank_str = genbank_str_io.getvalue()
        genbank_str_io.close()
        return genbank_str