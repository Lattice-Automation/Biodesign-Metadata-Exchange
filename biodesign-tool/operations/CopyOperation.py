"""
CopyOperation - Copies a portion of the current sequence to the clipboard.

Command format:
    COPY copy_start_index=start copy_end_index=end

Required arguments:
    copy_start_index: Starting position to copy from (0-based)
    copy_end_index: Ending position to copy from (exclusive)

Example:
    COPY copy_start_index=1 copy_end_index=100

Notes:
    - The indices must be within the sequence bounds
    - The copied sequence will be stored in the clipboard for use with PASTE
    - The source sequence's metadata ID will be stored with the copied sequence
    - The metadata will be updated to track the copy operation
"""

from .IOperation import IOperation


class CopyOperation(IOperation):
    def __init__(self):
        super().__init__()
        self.copy_start_index = None
        self.copy_end_index = None

    def validate_and_set_args(self, **args):
        """
        Validates and sets the arguments required for copying a sequence region.
        
        This method checks that all required arguments are present and valid:
        - copy_start_index: Starting position to copy from
        - copy_end_index: Ending position to copy from
        
        Args:
            **args: Keyword arguments containing the operation parameters
            
        Raises:
            ValueError: If any required argument is missing
        """
        copy_start_index = args.get("copy_start_index")
        copy_end_index = args.get("copy_end_index")
        if copy_start_index is None or copy_end_index is None:
            raise ValueError("COPY operation requires both a copy_start_index and a copy_end_index")
        self.copy_start_index = int(copy_start_index)
        self.copy_end_index = int(copy_end_index)

    def get_operation_args(self):
        return {
            "copy_start_index": self.copy_start_index,
            "copy_end_index": self.copy_end_index
        }

    def get_operation_name(self):
        return "COPY"

    def get_operation_details(self):
        """
        Returns the details of the copy operation.
        
        This method provides a dictionary containing all the parameters
        that define this specific copy operation.
        
        Returns:
            dict: A dictionary containing the copy start and end positions
        """
        return {
            "copy_start_index": self.copy_start_index,
            "copy_end_index": self.copy_end_index
        }

    def pre_execute(self, state):
        return

    def post_execute(self, state, record):
        return

    def apply_operation(self, state, record, **kwargs):
        """
        Copies a portion of the sequence to the clipboard.
        
        This method extracts a subsequence from the current sequence based on the
        specified start and end indices, and stores it in the clipboard along with
        the source metadata ID for tracking purposes.
        
        Args:
            state (dict): The current state containing the file name and clipboard
            record (SeqRecord): The sequence record to copy from
            **kwargs: Additional keyword arguments
            
        Returns:
            None: The copied sequence is stored in the state's clipboard
        """
        original_seq = str(record.seq)
        copied_sequence = original_seq[self.copy_start_index:self.copy_end_index]
        state['clipboard']['text'] = copied_sequence
        state['clipboard']['copied_from'] = state['current_metadata_id']
        return
