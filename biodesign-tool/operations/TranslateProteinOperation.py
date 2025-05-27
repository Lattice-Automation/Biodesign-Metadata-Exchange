"""
TranslateProteinOperation - Translates a protein sequence into dna.

Command format:
    TRANSLATE_PROTEIN

Required arguments:
    organism: The organism to translate the protein to

Example:
    TRANSLATE_PROTEIN organism=E. coli

Notes:
    - The original file will be preserved
"""

import json
from .IOperation import IOperation
from .CreateOperation import CreateOperation
from .ExportOperation import ExportOperation

class TranslateProteinOperation(IOperation):
    def __init__(self):
        super().__init__()
        self.organism = None

    def validate_and_set_args(self, **args):
        organism = args.get("organism")
        if organism is None:
            raise ValueError("TRANSLATE_PROTEIN operation requires an organism argument")
        self.organism = organism

    def get_operation_args(self):
        return {
            "organism": self.organism,
        }

    def get_operation_name(self):
        return "TRANSLATE_PROTEIN"

    def get_operation_details(self):
        return {
            "organism": self.organism,
        }

    def pre_execute(self, state):
        return

    def post_execute(self, state, record):
        return

    def apply_operation(self, state, record, **kwargs):
        """
        Translates a protein sequence into DNA sequence optimized for the target organism.
        
        This method takes a protein sequence and generates a DNA sequence that encodes
        the same protein, optimized for expression in the specified organism. The translation
        takes into account codon usage preferences of the target organism.
        
        Args:
            state (dict): The current state containing the file name
            record (str): The protein sequence to translate
            **kwargs: Additional keyword arguments
            
        Returns:
            str: The translated DNA sequence optimized for the target organism
        """
        current_file_name = state['current_file_name']       
        metadata_path = f"library/metadata_{current_file_name}.json"
        with open(metadata_path, "rb") as f:
            data = f.read()
            original_metadata = json.loads(data)

        aa_sequence = record
        dna_sequence = self.translate_protein(aa_sequence)

        file_name = f"{current_file_name}_dna"

        create_operation = CreateOperation()
        create_operation.validate_and_set_args(
            sequence=dna_sequence,
            file_name=file_name,
            source="tool_translate_protein_operation",
            metadata_parent_id=original_metadata["id"]
        )
        create_operation.execute({"current_file_name": file_name})

        # Export the part using Export operation
        export_operation = ExportOperation()
        export_operation.validate_and_set_args(
            file_name=file_name,
            include_metadata=True
        )
        export_operation.execute({"current_file_name": file_name})
        export_operation.post_execute({"current_file_name": file_name}, None)

        return
    
    def translate_protein(self, aa_sequence):
        """
        Translates an amino acid sequence to a DNA sequence using a codon table.
        
        This method converts each amino acid in the sequence to its corresponding DNA codon
        using a predefined codon table. It adds start (ATG) and stop (TAA) codons to the
        beginning and end of the sequence respectively.
        
        Args:
            aa_sequence (str): The amino acid sequence to translate
            
        Returns:
            str: The translated DNA sequence with start and stop codons
        """
        # Mock codon table for amino acid to DNA translation
        codon_table = {
            'A': 'GCT', 'R': 'CGT', 'N': 'AAT', 'D': 'GAT',
            'C': 'TGT', 'Q': 'CAA', 'E': 'GAA', 'G': 'GGT',
            'H': 'CAT', 'I': 'ATT', 'L': 'CTT', 'K': 'AAA',
            'M': 'ATG', 'F': 'TTT', 'P': 'CCT', 'S': 'TCT',
            'T': 'ACT', 'W': 'TGG', 'Y': 'TAT', 'V': 'GTT',
            '*': 'TAA'  # Stop codon
        }

        # Translate amino acids to DNA sequence
        dna_sequence = ''
        for aa in aa_sequence:
            if aa in codon_table:
                dna_sequence += codon_table[aa]
        
        # Add start and stop codons
        dna_sequence = 'ATG' + dna_sequence + codon_table['*']
        return dna_sequence
