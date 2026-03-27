"""
DesignProteinOperation - Designs a protein using a given model.

Command format:
    DESIGN_PROTEIN

Required arguments:
    num_seq_per_target: Number of sequences to design per target
    sampling_temp: Sampling temperature
    interface_cutoff: Interface cutoff
    model: Model to use for design

Example:
    DESIGN_PROTEIN num_seq_per_target=16 sampling_temp=0.1 interface_cutoff=10.0 model=ProteinMPNN

Notes:
    - The original file will be preserved
"""

import json
import random

from .IOperation import IOperation  
from .CreateProteinOperation import CreateProteinOperation

class DesignProteinOperation(IOperation):
    def __init__(self):
        super().__init__()
        self.num_seq_per_target = None
        self.sampling_temp = None
        self.interface_cutoff = None

    def validate_and_set_args(self, **args):
        """
        Validates and sets the arguments required for protein design.
        
        This method checks that all required arguments are present and valid:
        - num_seq_per_target: Number of sequences to design per target
        - sampling_temp: Sampling temperature for the design model
        - interface_cutoff: Interface cutoff value
        - model: The protein design model to use
        
        Args:
            **args: Keyword arguments containing the operation parameters
            
        Raises:
            ValueError: If any required argument is missing
        """
        num_seq_per_target = args.get("num_seq_per_target")
        if num_seq_per_target is None:
            raise ValueError("DESIGN_PROTEIN operation requires a num_seq_per_target argument")
        self.num_seq_per_target = num_seq_per_target

        sampling_temp = args.get("sampling_temp")
        if sampling_temp is None:
            raise ValueError("DESIGN_PROTEIN operation requires a sampling_temp argument")
        self.sampling_temp = sampling_temp

        interface_cutoff = args.get("interface_cutoff")
        if interface_cutoff is None:
            raise ValueError("DESIGN_PROTEIN operation requires an interface_cutoff argument")
        self.interface_cutoff = interface_cutoff

        model = args.get("model")
        if model is None:
            raise ValueError("DESIGN_PROTEIN operation requires a model argument")
        self.model = model

    def get_operation_args(self):
        return {
            "num_seq_per_target": self.num_seq_per_target,
            "sampling_temp": self.sampling_temp,
            "interface_cutoff": self.interface_cutoff,
            "model": self.model,
        }

    def get_operation_name(self):
        return "DESIGN_PROTEIN"

    def get_operation_details(self):
        return {
            "num_seq_per_target": self.num_seq_per_target,
            "sampling_temp": self.sampling_temp,
            "interface_cutoff": self.interface_cutoff,
            "model": self.model,
        }

    def pre_execute(self, state):
        return

    def post_execute(self, state, record):
        return

    def apply_operation(self, state, record, **kwargs):
        """
        Applies protein design operation to generate variant sequences.
        
        This method takes a protein structure and generates multiple variant sequences using
        the specified design model. For each generated sequence, it creates a new protein file
        and associated metadata, maintaining the parent-child relationship between designs.
        
        Args:
            state (dict): The current state containing the file name
            record (str): The protein structure in PDB format
            **kwargs: Additional keyword arguments
            
        Returns:
            None: The operation creates new files but doesn't return a value
        """
        current_file_name = state['current_file_name']       
        metadata_path = f"library/metadata_{current_file_name}.json"
        with open(metadata_path, "rb") as f:
            data = f.read()
            original_metadata = json.loads(data)

        # Get the PDB string from the record
        pdb_string = record

        # Extract the backbone from the PDB string
        backbone_pdb_strings = self.mock_proteinmpnn(pdb_string, num_sequences=3)

        for i, backbone_pdb_string in enumerate(backbone_pdb_strings):
            new_file_name = f"{current_file_name}_design_{i}"
            create_operation = CreateProteinOperation()
            create_operation.validate_and_set_args(
                pdb_string=backbone_pdb_string,
                file_name=new_file_name,
                source="tool_design_protein_operation",
                metadata_parent_id=original_metadata["id"]
            )
            create_operation.execute({"current_file_name": new_file_name}, is_protein=True)

        return
    
    def mock_proteinmpnn(self, pdb_string, num_sequences):
        """
        Simulates the ProteinMPNN protein design algorithm by generating variant sequences.
        
        This method takes a PDB structure and generates a specified number of variant sequences
        by randomly mutating approximately 20% of the positions while maintaining the overall
        structure. It's used as a placeholder for the actual ProteinMPNN algorithm.
        
        Args:
            pdb_string (str): The PDB structure in string format
            num_sequences (int): Number of variant sequences to generate
            
        Returns:
            list: A list of generated protein sequences
        """
        # Extract chain and residue information from PDB string
        residues = []
        current_res_id = None
        
        for line in pdb_string.split('\n'):
            if line.startswith('ATOM'):
                chain_id = line[21:22].strip()
                res_id = int(line[22:26].strip())
                res_name = line[17:20].strip()
                
                if (chain_id, res_id) != current_res_id:
                    residues.append((chain_id, res_id, res_name))
                    current_res_id = (chain_id, res_id)
        
        # Create a mapping of three-letter to one-letter amino acid codes
        aa_map = {
            'ALA': 'A', 'ARG': 'R', 'ASN': 'N', 'ASP': 'D', 'CYS': 'C',
            'GLN': 'Q', 'GLU': 'E', 'GLY': 'G', 'HIS': 'H', 'ILE': 'I',
            'LEU': 'L', 'LYS': 'K', 'MET': 'M', 'PHE': 'F', 'PRO': 'P',
            'SER': 'S', 'THR': 'T', 'TRP': 'W', 'TYR': 'Y', 'VAL': 'V'
        }
        
        # Get original sequence
        original_seq = ''.join(aa_map.get(res[2], 'X') for res in residues)
        
        # Function to simulate a designed sequence with mutations
        def generate_sequence(original):
            amino_acids = list("ACDEFGHIKLMNPQRSTVWY")
            # Mutate ~20% of positions
            positions_to_mutate = random.sample(range(len(original)), int(len(original) * 0.2))
            new_seq = list(original)
            
            for pos in positions_to_mutate:
                # Avoid the original amino acid
                choices = [aa for aa in amino_acids if aa != original[pos]]
                new_seq[pos] = random.choice(choices)
            
            return ''.join(new_seq)
        
        # Generate sequences
        sequences = []
        for i in range(num_sequences):
            seq = generate_sequence(original_seq)
            sequences.append(seq)
        
        return sequences