"""
InsertOperation - Inserts a sequence at a specified position.

Command format:
    INSERT insert_sequence=sequence_string insert_position=index

Required arguments:
    insert_sequence: DNA sequence string to insert (A, C, G, T)
    insert_position: Position where to insert the sequence (0-based)

Example:
    INSERT insert_sequence=acgtacgtacgt insert_position=5

Notes:
    - The sequence must contain only valid DNA bases (A, C, G, T)
    - The position must be within the sequence bounds
    - The sequence will be inserted at the specified position
    - The metadata will be updated to track the insert operation
"""

from Bio.Seq import Seq

from .IOperation import IOperation


class InsertOperation(IOperation):
    def __init__(self):
        super().__init__()
        self.insert_position = None
        self.insert_sequence = None

    def validate_and_set_args(self, **args):
        insert_position = args.get("insert_position")
        insert_sequence = args.get("insert_sequence")
        if insert_position is None or insert_sequence is None:
            raise ValueError("INSERT operation requires both an insert_position and an insert_sequence")
        self.insert_position = int(insert_position)
        self.insert_sequence = insert_sequence

    def get_operation_args(self):
        return {
            "insert_position": self.insert_position,
            "insert_sequence": self.insert_sequence
        }

    def get_operation_name(self):
        return "INSERT"

    def get_operation_details(self):
        return {
            "insert_position": self.insert_position,
            "insert_sequence": self.insert_sequence
        }

    def pre_execute(self, state):
        return

    def post_execute(self, state, record):
        return

    def apply_operation(self, state, record, **kwargs):
        """
        Inserts a DNA sequence at a specified position in the current sequence.
        
        This method takes the current sequence and inserts a new sequence at the
        specified position, creating a new record with the combined sequence.
        The original annotations and features are preserved in the new record.
        
        Args:
            state (dict): The current state containing the file name
            record (SeqRecord): The sequence record to modify
            **kwargs: Additional keyword arguments
            
        Returns:
            SeqRecord: The modified sequence record with the inserted sequence
            
        Raises:
            ValueError: If the insert position is beyond the sequence length
        """
        current_file_name = state['current_file_name']
        original_seq = str(record.seq)
        if self.insert_position >= len(original_seq):
            raise ValueError("The insert_position argument must be less than the length of the sequence")
        modified_seq = original_seq[:self.insert_position] + self.insert_sequence + original_seq[self.insert_position:]
        modified_seq_gb = Seq(modified_seq)
        new_record = self.save_new_record(current_file_name, record, modified_seq_gb, record.annotations, record.features)
        return new_record
