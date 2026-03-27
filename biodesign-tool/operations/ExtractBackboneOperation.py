"""
ExtractBackboneOperation - Extracts the backbone from a PDB file.

Command format:
    EXTRACT_BACKBONE

Required arguments:
    output_file_name: Name of the output file to save the backbone to

Example:
    EXTRACT_BACKBONE output_file_name=my_design_backbone

Notes:
    - The original file will be preserved
"""

import json

from .IOperation import IOperation  
from .CreateProteinOperation import CreateProteinOperation

class ExtractBackboneOperation(IOperation):
    def __init__(self):
        super().__init__()
        self.output_file_name = None

    def validate_and_set_args(self, **args):
        """
        Validates and sets the arguments required for extracting a protein backbone.
        
        This method checks that all required arguments are present and valid:
        - output_file_name: Name of the output file to save the backbone to
        
        Args:
            **args: Keyword arguments containing the operation parameters
            
        Raises:
            ValueError: If any required argument is missing
        """
        output_file_name = args.get("output_file_name")
        if output_file_name is None:
            raise ValueError("EXTRACT_BACKBONE operation requires an output_file_name argument")
        self.output_file_name = output_file_name

    def get_operation_args(self):
        return {
            "output_file_name": self.output_file_name,
        }

    def get_operation_name(self):
        return "EXTRACT_BACKBONE"

    def get_operation_details(self):
        """
        Returns the details of the backbone extraction operation.
        
        This method provides a dictionary containing all the parameters
        that define this specific backbone extraction operation.
        
        Returns:
            dict: A dictionary containing the output file name
        """
        return {
            "output_file_name": self.output_file_name,
        }

    def pre_execute(self, state):
        return

    def post_execute(self, state, record):
        return

    def apply_operation(self, state, record, **kwargs):
        """
        Extracts the backbone from a protein structure and creates a new PDB file.
        
        This method reads the original protein's metadata, extracts the backbone atoms
        (N, CA, C, O) from the PDB structure, and creates a new PDB file containing
        only the backbone atoms. The new file is created using CreateProteinOperation
        with the original metadata ID as parent.
        
        Args:
            state (dict): The current state containing the file name
            record (str): The protein structure in PDB format
            **kwargs: Additional keyword arguments
            
        Returns:
            None: The backbone structure is saved as a new PDB file
            
        Note:
            - Only backbone atoms (N, CA, C, O) are preserved in the output
            - The original file remains unchanged
            - The new file inherits metadata from the original structure
        """
        current_file_name = state['current_file_name']       
        metadata_path = f"library/metadata_{current_file_name}.json"
        with open(metadata_path, "rb") as f:
            data = f.read()
            original_metadata = json.loads(data)

        # Get the PDB string from the record
        pdb_string = record

        # Extract the backbone from the PDB string
        backbone_pdb_string = self.extract_backbone(pdb_string)

        create_operation = CreateProteinOperation()
        create_operation.validate_and_set_args(
            pdb_string=backbone_pdb_string,
            file_name=self.output_file_name,
            source="tool_extract_backbone_operation",
            metadata_parent_id=original_metadata["id"]
        )
        create_operation.execute({"current_file_name": self.output_file_name}, is_protein=True)

        return
    
    def extract_backbone(self, pdb_content):
        """
        Extracts backbone atoms from a PDB structure.
        
        This method processes a PDB file content and extracts only the backbone atoms
        (N, CA, C, O) from each residue. It preserves the original PDB format and
        atom information, only filtering out non-backbone atoms.
        
        Args:
            pdb_content (str): The complete PDB file content as a string
            
        Returns:
            str: A new PDB file content containing only backbone atoms
            
        Note:
            - Only ATOM records are processed
            - Only atoms with names N, CA, C, and O are kept
            - The original PDB format and atom information is preserved
            - All other atoms and records (HETATM, TER, etc.) are removed
        """
        backbone_atoms = {"N", "CA", "C", "O"}
        backbone_lines = []

        for line in pdb_content.splitlines():
            if line.startswith("ATOM"):  # Ensure it's an atom line
                atom_name = line[12:16].strip()  # Extract atom name
                if atom_name in backbone_atoms:
                    backbone_lines.append(line)  # Keep only backbone atoms

        return "\n".join(backbone_lines)  # Return as a single string
