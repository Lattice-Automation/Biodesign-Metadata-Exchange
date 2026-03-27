"""
CreateProteinOperation - Creates a new PDB file with a specified sequence.

Command format:
    CREATE_PROTEIN file_name=name pdb_string=pdb_string [source=source_name] [metadata_parent_id=id]

Required arguments:
    file_name: Name for the new PDB file (without extension)
    pdb_string: PDB string

Optional arguments:
    source: Source of the creation (default: "command_line")
    metadata_parent_id: ID of parent metadata (default: "")

Example:
    CREATE_PROTEIN file_name=my_design pdb_string="HEADER    FLUORESCENT PROTEIN "

Notes:
    - The file will be created in the library directory
    - A new metadata file will be automatically created
"""

import os

from Bio import SeqIO
from Bio.Seq import Seq
from Bio.SeqRecord import SeqRecord

from .IOperation import IOperation


class CreateProteinOperation(IOperation):
    def __init__(self):
        super().__init__()
        self.file_name = None
        self.pdb_string = None
        self.source = None
        self.metadata_parent_id = None

    def validate_and_set_args(self, **args):
        """
        Validates and sets the arguments required for creating a new protein structure.
        
        This method checks that all required arguments are present and valid:
        - file_name: Name for the new PDB file
        - pdb_string: Protein structure in PDB format
        - source: Optional source of the creation
        - metadata_parent_id: Optional parent metadata ID
        
        Args:
            **args: Keyword arguments containing the operation parameters
            
        Raises:
            ValueError: If required arguments are missing or if file already exists
        """
        file_name = args.get("file_name")
        pdb_string = args.get("pdb_string")
        if not file_name or not pdb_string:
            raise ValueError("CREATE_PROTEIN operation requires a file_name and a pdb_string argument")
        self.file_name = file_name
        self.pdb_string = pdb_string
        if os.path.exists(f"library/{self.file_name}.pdb"):
            raise ValueError(f"A file with the name {self.file_name}.pdb already exists")

        self.source = args.get("source", "command_line")
        self.metadata_parent_id = args.get("metadata_parent_id", "")

    def get_operation_args(self):
        return {
            "file_name": self.file_name,
            "pdb_string": self.pdb_string
        }

    def get_operation_name(self):
        return "CREATE_PROTEIN"

    def get_operation_details(self):
        """
        Returns the details of the protein creation operation.
        
        This method provides a dictionary containing all the parameters
        that define this specific protein creation operation.
        
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
        Creates a new PDB file with the specified protein structure.
        
        This method creates a new PDB file in the library directory with the
        provided protein structure. It writes the PDB string directly to the file
        and then opens the protein structure and creates associated metadata if needed.
        
        Args:
            state (dict): The current state containing the file name
            record (str): Not used in this operation
            **kwargs: Additional keyword arguments
            
        Returns:
            str: The protein structure in PDB format
        """
        file_path = f"library/{self.file_name}.pdb"
        with open(file_path, "w") as output_handle:
            output_handle.write(self.pdb_string)

        record, metadata_path = self.open_protein_and_create_metadata_if_needed(state['current_file_name'], self.metadata_parent_id)
        return record
