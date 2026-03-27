"""
DeleteOperation - Deletes a portion of the sequence.

Command format:
    DELETE delete_start_position=start delete_end_position=end

Required arguments:
    delete_start_position: Starting position of the sequence to delete (0-based)
    delete_end_position: Ending position of the sequence to delete (inclusive)

Example:delete_end_position
    DELETE delete_start_position=5 end_index=10

Notes:
    - The indices must be within the sequence bounds
    - The sequence between delete_start_position and delete_end_position will be deleted
    - The metadata will be updated to track the deletion
"""

from Bio.Seq import Seq

from .IOperation import IOperation


class DeleteOperation(IOperation):
    def __init__(self):
        super().__init__()
        self.delete_start_position = None
        self.delete_end_position = None

    def validate_and_set_args(self, **args):
        delete_start_position = args.get("delete_start_position")
        delete_end_position = args.get("delete_end_position")
        if delete_start_position is None or delete_end_position is None:
            raise ValueError("DELETE operation requires both a delete_start_position and a delete_end_position")
        self.delete_start_position = int(delete_start_position)
        self.delete_end_position = int(delete_end_position)

    def get_operation_args(self):
        return {
            "delete_start_position": self.delete_start_position,
            "delete_end_position": self.delete_end_position
        }

    def get_operation_name(self):
        return "DELETE"

    def get_operation_details(self):
        return {
            "delete_start_position": self.delete_start_position,
            "delete_end_position": self.delete_end_position
        }

    def pre_execute(self, state):
        return

    def post_execute(self, state, record):
        return

    def apply_operation(self, state, record, **kwargs):
        """
        Deletes a portion of the sequence between specified positions.
        
        This method removes the sequence between the start and end positions,
        creating a new record with the remaining sequence. The original
        annotations and features are preserved in the new record.
        
        Args:
            state (dict): The current state containing the file name
            record (SeqRecord): The sequence record to modify
            **kwargs: Additional keyword arguments
            
        Returns:
            SeqRecord: The modified sequence record with the deleted region removed
            
        Raises:
            ValueError: If either position is beyond the sequence length
        """
        current_file_name = state['current_file_name']
        original_seq = str(record.seq)
        if self.delete_start_position >= len(original_seq):
            raise ValueError("The delete_start_position argument must be less than the length of the sequence")
        if self.delete_end_position >= len(original_seq):
            raise ValueError("The delete_end_position argument must be less than the length of the sequence")
        modified_seq = original_seq[:self.delete_start_position] + original_seq[self.delete_end_position:]
        modified_seq_gb = Seq(modified_seq)
        new_record = self.save_new_record(current_file_name, record, modified_seq_gb, record.annotations, record.features)
        return new_record
