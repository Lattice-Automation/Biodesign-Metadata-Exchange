"""
OpenOperation - Opens an existing sequence file.

Command format:
    OPEN file_name=name [metadata_parent_id=id]

Required arguments:
    file_name: Name of the file to open (without extension)

Optional arguments:
    metadata_parent_id: ID of parent metadata (default: "")

Example:
    OPEN file_name=my_design

Notes:
    - The file must exist in the library directory
    - The file must be a valid GenBank file
    - This operation sets the current working file
"""

import os

from .IOperation import IOperation


class OpenOperation(IOperation):
    def __init__(self):
        super().__init__()
        self.file_name = None

    def validate_and_set_args(self, **args):
        """
        Validates and sets the arguments required for opening a sequence file.
        
        This method checks that all required arguments are present and valid:
        - file_name: Name of the file to open
        - metadata_parent_id: Optional ID of parent metadata
        
        Args:
            **args: Keyword arguments containing the operation parameters
            
        Raises:
            ValueError: If file_name is missing or if file doesn't exist
        """
        file_name = args.get("file_name")
        if not file_name:
            raise ValueError("OPEN operation requires a file_name")
        self.file_name = file_name
        if not os.path.exists(f"library/{self.file_name}.gb"):
            raise ValueError(f"A file with the name {self.file_name}.gb doesn't exist")

        self.metadata_parent_id = args.get("metadata_parent_id", "")

    def get_operation_args(self):
        return {
            "file_name": self.file_name,
        }

    def get_operation_name(self):
        return "OPEN"

    def get_operation_details(self):
        """
        Returns the details of the sequence open operation.
        
        This method provides a dictionary containing all the parameters
        that define this specific sequence open operation.
        
        Returns:
            dict: A dictionary containing the file name
        """
        return {
            "file_name": self.file_name,
        }

    def post_execute(self, state, record):
        return

    def pre_execute(self, state):
        return

    def apply_operation(self, state, record, **kwargs):
        record, metadata_path = self.open_sequence_and_create_metadata_if_needed(state['current_file_name'], self.metadata_parent_id)
        return record
