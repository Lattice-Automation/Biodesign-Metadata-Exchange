"""
AppendOperation - Appends a sequence to the end of the current sequence.

Command format:
    APPEND insert_sequence=sequence_string

Required arguments:
    insert_sequence: DNA sequence string to append (A, C, G, T)

Example:
    APPEND insert_sequence=acgtacgtacgt

Notes:
    - The sequence must contain only valid DNA bases (A, C, G, T)
    - The sequence will be appended to the current sequence
    - The metadata will be updated to track the append operation
"""

from Bio.Seq import Seq

from .IOperation import IOperation


class AppendOperation(IOperation):
    def __init__(self):
        super().__init__()
        self.insert_sequence = None

    def validate_and_set_args(self, **args):
        insert_sequence = args.get("insert_sequence")
        if not insert_sequence:
            raise ValueError("APPEND operation requires an insert_sequence argument")
        self.insert_sequence = insert_sequence

    def get_operation_args(self):
        return {
            "insert_sequence": self.insert_sequence
        }

    def get_operation_name(self):
        return "APPEND"

    def get_operation_details(self):
        return {
            "insert_sequence": self.insert_sequence
        }

    def pre_execute(self, state):
        return

    def post_execute(self, state, record):
        return

    def apply_operation(self, state, record, **kwargs):
        """
        Appends a DNA sequence to the end of the current sequence.
        
        This method takes the current sequence and adds a new sequence at the end,
        creating a new record with the combined sequence. The original annotations
        and features are preserved in the new record.
        
        Args:
            state (dict): The current state containing the file name
            record (SeqRecord): The sequence record to modify
            **kwargs: Additional keyword arguments
            
        Returns:
            SeqRecord: The modified sequence record with the appended sequence
        """
        original_seq = str(record.seq)
        modified_seq = original_seq + self.insert_sequence
        modified_seq_gb = Seq(modified_seq)
        new_record = self.save_new_record(state['current_file_name'], record, modified_seq_gb, record.annotations, record.features)
        return new_record
