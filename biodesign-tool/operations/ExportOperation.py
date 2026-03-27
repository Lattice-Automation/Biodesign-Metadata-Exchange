"""
ExportOperation - Exports the current sequence and optionally its metadata.

Command format:
    EXPORT include_metadata=True/False

Optional arguments:
    include_metadata: Whether to include metadata in the export (default: True)

Example:
    EXPORT include_metadata=True

Notes:
    - The sequence will be exported to the exported directory
    - If include_metadata is True, the metadata will be exported as well
    - The exported files will be encrypted
"""

from .IOperation import IOperation
import shutil


class ExportOperation(IOperation):
    def __init__(self):
        super().__init__()
        self.include_metadata = None

    def validate_and_set_args(self, **args):
        """
        Validates and sets the arguments required for exporting a sequence.
        
        This method checks that all required arguments are present and valid:
        - include_metadata: Whether to include metadata in the export
        
        Args:
            **args: Keyword arguments containing the operation parameters
            
        Raises:
            ValueError: If any required argument is missing
        """
        include_metadata = args.get("include_metadata")
        if include_metadata is None:
            raise ValueError("EXPORT operation requires an include_metadata argument")
        self.include_metadata = bool(include_metadata)

    def get_operation_args(self):
        return {
            "include_metadata": self.include_metadata
        }

    def get_operation_name(self):
        return "EXPORT"

    def get_operation_details(self):
        """
        Returns the details of the sequence export operation.
        
        This method provides a dictionary containing all the parameters
        that define this specific sequence export operation.
        
        Returns:
            dict: A dictionary containing the metadata inclusion flag
        """
        return {
            "include_metadata": self.include_metadata,
        }

    def pre_execute(self, state):
        return

    def post_execute(self, state, record):
        """
        Performs the actual export operation after validation.
        
        This method copies the sequence file to the exported directory and,
        if include_metadata is True, also exports the metadata file. The metadata
        is encrypted before being written to the exported directory.
        
        Args:
            state (dict): The current state containing the file name
            record (SeqRecord): Not used in this operation
            
        Note:
            - The sequence file is copied as-is to the exported directory
            - The metadata file is encrypted before being exported
            - Both files maintain their original names in the exported directory
        """
        current_file_name = state['current_file_name']
        file_path = f"library/{current_file_name}.gb"
        shutil.copy(file_path, f"exported/{current_file_name}.gb")
        if self.include_metadata:
            metadata_path = f"library/metadata_{current_file_name}.json"
            with open(metadata_path, "rb") as f:
                data = f.read()
                data_string = data.decode("utf-8")
                encrypted_metadata = self.biodesign_metadata.encrypt_string(data_string)
            with open(f"exported/metadata_{current_file_name}.txt", "wb") as f:
                encrypted_metadata_bytes = encrypted_metadata.encode("utf-8")
                f.write(encrypted_metadata_bytes)

    def apply_operation(self, state, record, **kwargs):
        return

