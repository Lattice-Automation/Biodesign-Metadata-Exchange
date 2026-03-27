"""
CreateOperation - Creates a new GenBank file with a specified sequence.

Command format:
    CREATE file_name=name sequence=sequence_string [source=source_name] [metadata_parent_id=id]

Required arguments:
    file_name: Name for the new GenBank file (without extension)
    sequence: DNA sequence string (A, C, G, T)

Optional arguments:
    source: Source of the creation (default: "command_line")
    metadata_parent_id: ID of parent metadata (default: "")

Example:
    CREATE file_name=my_design sequence=acgtacgtacgt

Notes:
    - The sequence must contain only valid DNA bases (A, C, G, T)
    - The file will be created in the library directory
    - A new metadata file will be automatically created
"""

import os

from Bio import SeqIO
from Bio.Seq import Seq
from Bio.SeqRecord import SeqRecord

from .IOperation import IOperation


class CreateOperation(IOperation):
    def __init__(self):
        super().__init__()
        self.file_name = None
        self.sequence = None
        self.source = None
        self.metadata_parent_id = None

    def validate_and_set_args(self, **args):
        """
        Validates and sets the arguments required for creating a new sequence.
        
        This method checks that all required arguments are present and valid:
        - file_name: Name for the new GenBank file
        - sequence: DNA sequence to create
        - source: Optional source of the creation
        - metadata_parent_id: Optional parent metadata ID
        
        Args:
            **args: Keyword arguments containing the operation parameters
            
        Raises:
            ValueError: If required arguments are missing or if file already exists
        """
        file_name = args.get("file_name")
        sequence = args.get("sequence")
        if not file_name or not sequence:
            raise ValueError("CREATE operation requires a file_name and a sequence argument")
        self.file_name = file_name
        self.sequence = sequence
        if os.path.exists(f"library/{self.file_name}.gb"):
            raise ValueError(f"A file with the name {self.file_name}.gb already exists")

        self.source = args.get("source", "command_line")
        self.metadata_parent_id = args.get("metadata_parent_id", "")

    def get_operation_args(self):
        return {
            "file_name": self.file_name,
            "sequence": self.sequence
        }

    def get_operation_name(self):
        return "CREATE"

    def get_operation_details(self):
        """
        Returns the details of the create operation.
        
        This method provides a dictionary containing all the parameters
        that define this specific creation operation.
        
        Returns:
            dict: A dictionary containing the file name and source information
        """
        return {
            "file_name": self.file_name,
            "source": self.source
        }

    def post_execute(self, state, record):
        return

    def pre_execute(self, state):
        return

    def apply_operation(self, state, record, **kwargs):
        """
        Creates a new GenBank file with the specified sequence.
        
        This method creates a new GenBank file in the library directory with the
        provided sequence. It creates a SeqRecord with the sequence and basic
        annotations, converts it to lowercase, and writes it to a GenBank file.
        It then opens the sequence and creates associated metadata if needed.
        
        Args:
            state (dict): The current state containing the file name
            record (SeqRecord): Not used in this operation
            **kwargs: Additional keyword arguments
            
        Returns:
            SeqRecord: The newly created sequence record
        """
        file_path = f"library/{self.file_name}.gb"
        new_record = SeqRecord(
            seq=Seq(self.sequence),
            name=self.file_name,
            description="",
            annotations={"molecule_type": "DNA"}
        ).lower()
        with open(file_path, "w") as output_handle:
            SeqIO.write(new_record, output_handle, "genbank")

        record, metadata_path = self.open_sequence_and_create_metadata_if_needed(state['current_file_name'], self.metadata_parent_id)
        return record
