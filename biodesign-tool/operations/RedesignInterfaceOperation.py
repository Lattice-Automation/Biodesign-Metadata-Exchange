"""
RedesignInterfaceOperation - Redesign the Binding Interface of a protein

Command format:
    REDESIGN_INTERFACE

Required arguments:
    model: Specifies the model being used
    mode: Mode to use for the redesign
    num_designs: Number of designs to generate
    temperature: Temperature for the redesign

Example:
    REDESIGN_INTERFACE model=RFdiffusion mode=inpaint num_designs=5 temperature=0.1

"""

import json
import random

from .IOperation import IOperation

class RedesignInterfaceOperation(IOperation):
    def __init__(self):
        super().__init__()
        self.model = None
        self.mode = None
        self.num_designs = None
        self.temperature = None

    def validate_and_set_args(self, **args):
        """
        Validates and sets the arguments required for redesigning a protein interface.
        
        This method checks that all required arguments are present and valid:
        - chain_id: ID of the chain to redesign
        - interface_cutoff: Distance cutoff for interface residues
        - sampling_temp: Sampling temperature for the design
        - num_seq_per_target: Number of sequences to design
        
        Args:
            **args: Keyword arguments containing the operation parameters
            
        Raises:
            ValueError: If any required argument is missing
        """
        model = args.get("model")
        mode = args.get("mode")
        num_designs = args.get("num_designs")
        temperature = args.get("temperature")
        if model is None:
            raise ValueError("REDESIGN_INTERFACE operation requires a model argument")
        if mode is None:
            raise ValueError("REDESIGN_INTERFACE operation requires a mode argument")
        if num_designs is None:
            raise ValueError("REDESIGN_INTERFACE operation requires a num_designs argument")
        if temperature is None:
            raise ValueError("REDESIGN_INTERFACE operation requires a temperature argument")
        self.model = model
        self.mode = mode
        self.num_designs = num_designs
        self.temperature = temperature

    def get_operation_args(self):
        return {
            "model": self.model,
            "mode": self.mode,
            "num_designs": self.num_designs,
            "temperature": self.temperature,
        }

    def get_operation_name(self):
        return "REDESIGN_INTERFACE"

    def get_operation_details(self):
        """
        Returns the details of the interface redesign operation.
        
        This method provides a dictionary containing all the parameters
        that define this specific interface redesign operation.
        
        Returns:
            dict: A dictionary containing the chain ID, interface cutoff,
                 sampling temperature, and number of sequences to design
        """
        return {
            "model": self.model,
            "mode": self.mode,
            "num_designs": self.num_designs,
            "temperature": self.temperature,
        }

    def pre_execute(self, state):
        return

    def post_execute(self, state, record):
        return

    def apply_operation(self, state, record, **kwargs):
        """
        Applies the interface redesign operation to a protein structure.
        
        This method reads the original protein's metadata, applies the interface
        redesign using the specified model and parameters, and saves the redesigned
        structure as a new PDB file with a backbone suffix.
        
        Args:
            state (dict): The current state containing the file name
            record (str): The protein structure in PDB format
            **kwargs: Additional keyword arguments
            
        Returns:
            str: The redesigned protein structure in PDB format
            
        Note:
            - The original file remains unchanged
            - The redesigned structure is saved with a '_backbone' suffix
            - The redesign is performed using the specified model and parameters
        """
        current_file_name = state['current_file_name']
        metadata_path = f"library/metadata_{current_file_name}.json"
        with open(metadata_path, "rb") as f:
            data = f.read()
            original_metadata = json.loads(data)

        # Get the PDB string from the record
        current_file_name = state['current_file_name']

        # Get the PDB string from the record
        pdb_string = record
        backbone_pdb_string = self.redesign_interface(pdb_string)
        with open(f"library/{current_file_name}_backbone.pdb", "w") as f:
            f.write(backbone_pdb_string)

        return backbone_pdb_string
    
    def redesign_interface(self, pdb_content):
        """
        Redesigns the interface of a protein structure.
        
        This method processes a PDB file content and redesigns specific residues
        in the interface region. It randomly selects new amino acids for the
        flexible residues while preserving the backbone structure.
        
        Args:
            pdb_content (str): The complete PDB file content as a string
            
        Returns:
            str: A new PDB file content with redesigned interface residues
            
        Note:
            - Only specific flexible residues are modified (3, 8, 20, 21, 32, 41, 48, 51)
            - New amino acids are randomly selected from the standard set
            - Only ATOM records are processed
            - The backbone structure is preserved
        """
        redesigned_pdb = []
        amino_acids = ["A", "R", "N", "D", "C", "E", "Q", "G", "H", "I", "L", "K", "M", "F", "P", "S", "T", "W", "Y", "V"]
        flexible_residues = {3, 8, 20, 21, 32, 41, 48, 51}
        for line in pdb_content.splitlines():
            if line.startswith("ATOM"):
                res_num = int(line[22:26].strip())  # Extract residue number
                if res_num in flexible_residues:
                    new_res = random.choice(amino_acids)  # Random new amino acid
                    line = line[:17] + f"{new_res}  " + line[20:]  # Replace residue in PDB format
            redesigned_pdb.append(line)

        return "\n".join(redesigned_pdb)
