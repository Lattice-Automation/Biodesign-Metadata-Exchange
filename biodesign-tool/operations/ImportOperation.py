"""
ImportOperation - Imports a GenBank file and its associated metadata into the library.

Command format:
    IMPORT design_path=path/to/file.gb metadata_path=path/to/metadata.json

Required arguments:
    design_path: Path to the GenBank file to import
    metadata_path: Path to the metadata JSON file associated with the design

Example:
    IMPORT design_path=./library/example.gb metadata_path=./library/metadata_example.json

Notes:
    - The GenBank file must exist at the specified path
    - The metadata file must exist and be valid
    - The checksums in the metadata must match the design file
    - The files will be copied to the library directory
"""

import json
import os
import shutil

from Bio import SeqIO

from .IOperation import IOperation


class ImportOperation(IOperation):
    def __init__(self):
        super().__init__()
        self.design_path = None
        self.metadata_path = None

    def validate_and_set_args(self, **args):
        """
        Validates and sets the arguments required for importing a sequence file.
        
        This method checks that all required arguments are present and valid:
        - design_path: Path to the GenBank file to import
        - metadata_path: Path to the metadata JSON file
        
        Args:
            **args: Keyword arguments containing the operation parameters
            
        Raises:
            ValueError: If design_path or metadata_path is missing, or if files don't exist
        """
        design_path = args.get("design_path")
        metadata_path = args.get("metadata_path")
        if not design_path or not metadata_path:
            raise ValueError("IMPORT operation requires a design_path and a metadata_path argument")
        if not os.path.exists(design_path):
            raise ValueError(f"The file {design_path} doesn't exist")
        if not os.path.exists(metadata_path):
            raise ValueError(f"The file {metadata_path} doesn't exist")
        self.design_path = design_path
        self.metadata_path = metadata_path

    def get_operation_args(self):
        return {
            "design_path": self.design_path,
            "metadata_path": self.metadata_path
        }

    def get_operation_name(self):
        return "IMPORT"

    def get_operation_details(self):
        """
        Returns the details of the sequence import operation.
        
        This method provides a dictionary containing all the parameters
        that define this specific sequence import operation.
        
        Returns:
            dict: A dictionary containing the design path, metadata path,
                 and source information
        """
        return {
            "design_path": self.design_path,
            "metadata_path": self.metadata_path,
            "source": "from_file"
        }

    def pre_execute(self, state):
        """
        Performs the actual import operation before execution.
        
        This method handles the import process by:
        1. Copying the GenBank file to the library directory
        2. Converting the sequence to lowercase
        3. Decrypting the metadata file
        4. Verifying that the checksums match between the design and metadata
        5. Saving the decrypted metadata to the library
        
        Args:
            state (dict): The current state containing the file name
            
        Raises:
            ValueError: If the checksums of the design and metadata don't match
            
        Note:
            - The original files remain unchanged
            - The GenBank sequence is converted to lowercase
            - The metadata is decrypted before being saved
            - Checksum verification ensures data integrity
        """
        current_file_name = state['current_file_name']
        # Copy the design to the library
        design_in_library_path = f"library/{current_file_name}.gb"
        shutil.copyfile(self.design_path, design_in_library_path)

        with open(design_in_library_path, "r") as input_handle:
            record = SeqIO.read(input_handle, "genbank")
            record = record.lower()

        # Unencrypt the metadata and save it in the library
        metadata_in_library_path = f"library/metadata_{current_file_name}.json"
        with open(self.metadata_path, "rb") as f:
            data = f.read()
            data_string = data.decode("utf-8")
            unencrypted_metadata = self.biodesign_metadata.decrypt_string(data_string)

            # Check the checksums match
            metadata_dict = json.loads(unencrypted_metadata)
            metadata_checksum = metadata_dict.get("designChecksum")
            design_checksum = self.biodesign_metadata.calculate_checksum(str(record.seq))
            if metadata_checksum != design_checksum:
                raise ValueError(f"Checksums of metadata and design don't match")

            # Save it in the library
            with open(metadata_in_library_path, "w") as f:
                f.write(unencrypted_metadata)

    def post_execute(self, state, record):
        return

    def apply_operation(self, state, record, **kwargs):
        return


