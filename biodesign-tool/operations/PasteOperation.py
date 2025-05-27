"""
PasteOperation - Pastes a sequence from the clipboard at a specified position.

Command format:
    PASTE position=index

Required arguments:
    position: Position where to paste the sequence (0-based)

Example:
    PASTE position=5

Notes:
    - The clipboard must contain a valid DNA sequence
    - The position must be within the sequence bounds
    - The sequence will be pasted at the specified position
    - The metadata will be updated to track the paste operation
"""

from Bio.Seq import Seq

from .IOperation import IOperation


class PasteOperation(IOperation):
    def __init__(self):
        super().__init__()
        self.paste_position = None
        self.pasted_text = None
        self.copied_from = None

    def validate_and_set_args(self, **args):
        """
        Validates and sets the arguments required for pasting a sequence.
        
        This method checks that all required arguments are present and valid:
        - paste_position: Position where to paste the sequence
        
        Args:
            **args: Keyword arguments containing the operation parameters
            
        Raises:
            ValueError: If the paste position argument is missing
        """
        paste_position = args.get("paste_position")
        if paste_position is None:
            raise ValueError("PASTE operation requires paste_position argument")
        self.paste_position = int(paste_position)

    def get_operation_args(self):
        return {
            "paste_position": self.paste_position,
        }

    def get_operation_name(self):
        return "PASTE"

    def get_operation_details(self):
        """
        Returns the details of the paste operation.
        
        This method provides a dictionary containing all the parameters
        that define this specific paste operation, including the paste
        position and information about the pasted text.
        
        Returns:
            dict: A dictionary containing the paste position and pasted text details
        """
        return {
            "paste_position": self.paste_position,
            "pasted_text": self.pasted_text,
            "copied_from": self.copied_from,
        }

    def pre_execute(self, state):
        return

    def post_execute(self, state, record):
        return

    def apply_operation(self, state, record, **kwargs):
        """
        Pastes a sequence from the clipboard into the current sequence.
        
        This method inserts the sequence stored in the clipboard at the specified
        position in the current sequence. It validates that the paste position is
        within bounds and that there is content in the clipboard to paste.
        
        Args:
            state (dict): The current state containing the file name and clipboard
            record (SeqRecord): The sequence record to paste into
            **kwargs: Additional keyword arguments
            
        Returns:
            SeqRecord: The modified sequence record with the pasted sequence
            
        Raises:
            ValueError: If paste position is out of bounds or clipboard is empty
        """
        self.pasted_text = state['clipboard']['text'],
        self.copied_from = state['clipboard']['copied_from']

        current_file_name = state['current_file_name']
        original_seq = str(record.seq)
        if self.paste_position >= len(original_seq):
            raise ValueError("The paste_position argument must be less than the length of the sequence")
        if state['clipboard']['text'] is None:
            raise ValueError("There is no text in the clipboard to paste")
        modified_seq = original_seq[:self.paste_position] + state['clipboard']['text'] + original_seq[self.paste_position:]
        modified_seq_gb = Seq(modified_seq)
        new_record = self.save_new_record(current_file_name, record, modified_seq_gb, record.annotations, record.features)
        return new_record
