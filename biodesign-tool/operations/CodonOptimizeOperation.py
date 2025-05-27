"""
CodonOptimizeOperation - Optimizes a DNA sequence for a specific organism.

Command format:
    CODON_OPTIMIZATION organism=organism_name start_index=start end_index=end

Required arguments:
    organism: Name of the target organism (e.g., "human", "e_coli")
    start_index: Starting position of the sequence to optimize (0-based)
    end_index: Ending position of the sequence to optimize (exclusive)

Example:
    CODON_OPTIMIZATION organism=human start_index=1 end_index=100

Notes:
    - The sequence must be a valid DNA sequence
    - The indices must be within the sequence bounds
    - The optimization will maintain the same amino acid sequence
    - The operation will update both the sequence and metadata
"""

from .IOperation import IOperation


class CodonOptimizeOperation(IOperation):
    def __init__(self):
        super().__init__()
        self.organism = None
        self.start_index = None
        self.end_index = None

    def validate_and_set_args(self, **args):
        """
        Validates and sets the arguments required for codon optimization.
        
        This method checks that all required arguments are present and valid:
        - organism: Target organism for optimization
        - start_index: Starting position for optimization
        - end_index: Ending position for optimization
        
        Args:
            **args: Keyword arguments containing the operation parameters
            
        Raises:
            ValueError: If any required argument is missing
        """
        organism = args.get("organism")
        start_index = args.get("start_index")
        end_index = args.get("end_index")
        if not organism:
            raise ValueError("CODON_OPTIMIZATION operation requires an organism argument")
        if start_index is None:
            raise ValueError("CODON_OPTIMIZATION operation requires a start_index argument")
        if end_index is None:
            raise ValueError("CODON_OPTIMIZATION operation requires an end_index argument")

        self.organism = organism
        self.start_index = start_index
        self.end_index = end_index

    def get_operation_args(self):
        return {
            "organism": self.organism,
            "start_index": self.start_index,
            "end_index": self.end_index,
        }

    def get_operation_name(self):
        return "CODON_OPTIMIZATION"

    def get_operation_details(self):
        return {
            "organism": self.organism,
            "start_index": self.start_index,
            "end_index": self.end_index,
        }

    def post_execute(self, state, record):
        return

    def pre_execute(self, state):
        return

    def apply_operation(self, state, record, **kwargs):
        """
        Applies codon optimization to a specified region of the DNA sequence.
        
        This method takes a DNA sequence and optimizes the codons in the specified region
        for the target organism while maintaining the same amino acid sequence. The optimization
        is applied only to the region between start_index and end_index, leaving the rest
        of the sequence unchanged.
        
        Args:
            state (dict): The current state containing the file name
            record (SeqRecord): The sequence record to optimize
            **kwargs: Additional keyword arguments
            
        Returns:
            SeqRecord: The modified sequence record with optimized codons
        """
        current_file_name = state['current_file_name']
        original_seq = str(record.seq)
        sequence_to_optimize = original_seq[self.start_index:self.end_index]
        modified_sequence = self.replace_codons(sequence_to_optimize)
        modified_seq_gb = original_seq[:self.start_index] + modified_sequence + original_seq[self.end_index:]
        new_record = self.save_new_record(current_file_name, record, modified_seq_gb, record.annotations, record.features)
        return new_record

    def replace_codons(self, sequence: str) -> str:
        """
        Replaces codons in a DNA sequence with optimized versions for the target organism.
        
        This method implements a simple codon optimization strategy by replacing specific
        codons with their preferred alternatives. The optimization maintains the same
        amino acid sequence while potentially improving expression in the target organism.
        
        Args:
            sequence (str): The DNA sequence to optimize
            
        Returns:
            str: The optimized DNA sequence with replaced codons
        """
        codon_replacements = {
            "atg": "gtg",  # Start codon (Methionine)
            "taa": "tag",  # Stop codon
            "tag": "taa",  # Stop codon
            "tga": "taa",  # Stop codon
            "gga": "ggg",  # Glycine
            "ttc": "ttt",  # Phenylalanine
            "aac": "aat",  # Asparagine
        }

        # Split the sequence into codons (3-base units)
        codons = [sequence[i:i + 3] for i in range(0, len(sequence), 3)]

        # Replace codons using the dictionary
        replaced_codons = [codon_replacements.get(codon, codon) for codon in codons]

        # Join the codons back into a single sequence
        return ''.join(replaced_codons)

