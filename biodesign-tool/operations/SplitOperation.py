"""
SplitOperation - Splits a sequence into multiple parts at specified positions.

Command format:
    SPLIT split_indices=[index1,index2,...]

Required arguments:
    split_indices: List of positions where to split the sequence (0-based/exclusive, i.e. splitting at [1], separates just the first base)

Example:
    SPLIT split_indices=[5,10,15]

Notes:
    - The indices must be within the sequence bounds
    - Each split will create a new file with the original name plus a suffix
    - The metadata will be updated to track the splits
    - The original file will be preserved
"""

import json
import ast

from .CreateOperation import CreateOperation
from .ExportOperation import ExportOperation
from .IOperation import IOperation


class SplitOperation(IOperation):
    def __init__(self):
        super().__init__()
        self.split_indices = None

    def validate_and_set_args(self, **args):
        """
        Validates and sets the arguments required for splitting a sequence.
        
        This method checks that all required arguments are present and valid:
        - split_indices: List of positions where to split the sequence
        
        Args:
            **args: Keyword arguments containing the operation parameters
            
        Raises:
            ValueError: If split_indices is missing or not in valid list format
        """
        split_indices = args.get("split_indices")
        if split_indices is None:
            raise ValueError("SPLIT operation requires an split_indices argument")
        if isinstance(split_indices, str):
            try:
                # Parse the string representation of the list into an actual list
                self.split_indices = ast.literal_eval(split_indices)
            except (ValueError, SyntaxError):
                raise ValueError("split_indices must be a valid list format, e.g. [1,2,3]")
        elif isinstance(split_indices, list):
            self.split_indices = split_indices
        else:
            raise ValueError("split_indices must be a list")

    def get_operation_args(self):
        return {
            "split_indices": self.split_indices,
        }

    def get_operation_name(self):
        return "SPLIT"

    def get_operation_details(self):
        """
        Returns the details of the split operation.
        
        This method provides a dictionary containing all the parameters
        that define this specific split operation.
        
        Returns:
            dict: A dictionary containing the list of split positions
        """
        return {
            "split_indices": self.split_indices,
        }

    def pre_execute(self, state):
        return

    def post_execute(self, state, record):
        return

    def apply_operation(self, state, record, **kwargs):
        """
        Splits a sequence into multiple parts at specified positions.
        
        This method reads the original sequence's metadata and splits the sequence
        at the specified indices. For each split part, it:
        1. Creates a new sequence file using CreateOperation
        2. Exports the new sequence using ExportOperation
        3. Maintains metadata inheritance from the original sequence
        
        Args:
            state (dict): The current state containing the file name
            record (SeqRecord): The sequence record to split
            **kwargs: Additional keyword arguments
            
        Returns:
            None: The split sequences are saved as separate files
            
        Raises:
            ValueError: If any split index is beyond the sequence length
            
        Note:
            - The original file remains unchanged
            - Each split part is saved with a suffix indicating its position
            - All split parts inherit metadata from the original sequence
            - Each part is automatically exported after creation
        """
        current_file_name = state['current_file_name']
        self.split_indices.sort()
        if self.split_indices[-1] >= len(record.seq):
            raise ValueError("The split indices argument must be less than the length of the sequence")

        metadata_path = f"library/metadata_{current_file_name}.json"
        with open(metadata_path, "rb") as f:
            data = f.read()
            original_metadata = json.loads(data)

        original_seq = str(record.seq)
        start = 0
        self.split_indices.append(len(record.seq))  # Add the end of the sequence as the last split index
        for split_index in self.split_indices:
            split_seq = original_seq[start:split_index]

            # Name for the new design split part
            split_part_file_name = f"{current_file_name}_{self.split_indices.index(split_index)}"

            # Create the part using Create operation
            create_operation = CreateOperation()
            create_operation.validate_and_set_args(
                sequence=split_seq,
                file_name=split_part_file_name,
                source="tool_split_operation",
                metadata_parent_id=original_metadata["id"]
            )
            create_operation.execute({"current_file_name": split_part_file_name})

            # Export the part using Export operation
            export_operation = ExportOperation()
            export_operation.validate_and_set_args(
                file_name=split_part_file_name,
                include_metadata=True
            )
            export_operation.execute({"current_file_name": split_part_file_name})
            export_operation.post_execute({"current_file_name": split_part_file_name}, None)

            start = split_index

        # Remove the last split index that was artificially added, so it shows properly in the get operation details
        self.split_indices.pop()

        return
