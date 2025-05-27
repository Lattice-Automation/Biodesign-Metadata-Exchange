from abc import ABC, abstractmethod
import os
from io import StringIO
import json
from BioDesignMetadataLibrary import BioDesignMetadataLibrary
from Bio import SeqIO
from Bio.SeqRecord import SeqRecord


class IOperation(ABC):
    def __init__(self):
        """
        Initializes the operation with a BioDesignMetadataLibrary instance.
        """
        self.biodesign_metadata = BioDesignMetadataLibrary()

    @abstractmethod
    def validate_and_set_args(self, **args):
        """
        Validates and sets the arguments required for the operation.
        
        This method should be implemented by each operation to validate
        its specific required arguments.
        
        Args:
            **args: Keyword arguments containing the operation parameters
            
        Raises:
            ValueError: If any required arguments are missing or invalid
        """
        pass

    @abstractmethod
    def get_operation_name(self):
        """
        Returns the name of the operation.
        
        Returns:
            str: The operation's name
        """
        pass

    @abstractmethod
    def get_operation_details(self):
        """
        Returns the details of the operation. Used to store the operation in the metadata.
        
        Returns:
            dict: A dictionary containing the operation's parameters and details
        """
        pass

    @abstractmethod
    def apply_operation(self, state, record, **kwargs):
        """
        Applies the operation to the given record.
        
        Args:
            state (dict): The current state containing file information
            record: The sequence or protein record to operate on
            **kwargs: Additional keyword arguments
            
        Returns:
            The modified record or None if no changes were made
        """
        pass

    @abstractmethod
    def pre_execute(self, state):
        """
        Performs any necessary setup before the operation is executed.
        
        Args:
            state (dict): The current state containing file information
        """
        pass

    @abstractmethod
    def post_execute(self, state, record):
        """
        Performs any necessary cleanup after the operation is executed.
        
        Args:
            state (dict): The current state containing file information
            record: The sequence or protein record that was operated on
        """
        pass

    def execute(self, state, is_protein=False):
        """
        Executes the operation with proper metadata handling and state management.
        
        This method orchestrates the operation execution by:
        1. Running pre-execution checks
        2. Loading or creating the sequence/protein record
        3. Applying the operation
        4. Computing differences and updating metadata
        5. Running post-execution tasks
        
        Args:
            state (dict): The current state containing file information
            is_protein (bool): Whether the operation is working with protein structures
            
        Returns:
            None: The operation modifies files and metadata but doesn't return a value
        """
        self.pre_execute(state)

        if is_protein:
            record, metadata_path = self.open_protein_and_create_metadata_if_needed(state['current_file_name'])
        else:
            record, metadata_path = self.open_sequence_and_create_metadata_if_needed(state['current_file_name'])

        new_record = self.apply_operation(state, record)

        diff = ""
        design_for_checksum = ""

        # For protein operations, the record is the PDB string, not a SeqRecord
        if is_protein:
            if record and new_record:
                diff = self.biodesign_metadata.compute_difference(record, new_record)
            
            if new_record:
                design_for_checksum = new_record
            else:
                design_for_checksum = record
        else:
            # Calculate the diff only if the operation produced a new record
            if record and new_record:
                diff = self.calculate_diff(record, new_record)

            # If the operation produced a new record, use it to calculate the checksum, if not, calculate it with the old record
            if new_record:
                design_for_checksum = str(new_record.seq)
            else:
                design_for_checksum = str(record.seq)

        self.biodesign_metadata.update_metadata_with_operation(
                    metadata_path=metadata_path,
                    design=design_for_checksum,
                    operation_code=self.get_operation_name(),
                    operation_details=self.get_operation_details(),
                    change=diff
                )

        # Store the current metadata id at the end of the operation
        with open(metadata_path, "rb") as f:
            data = f.read()
            original_metadata = json.loads(data)
            state['current_metadata_id'] = original_metadata['id']

        self.post_execute(state, new_record)

        print(f"Operation {self.get_operation_name()} executed successfully")

    def calculate_diff(self, original_record, modified_record):
        """
        Calculates the difference between two sequence records.
        
        This method converts both records to GenBank format strings and computes
        the difference between them using the metadata library's diff functionality.
        
        Args:
            original_record (SeqRecord): The original sequence record
            modified_record (SeqRecord): The modified sequence record
            
        Returns:
            str: A string representation of the differences between the records
        """
        original_seq_str = self.get_string_from_record(original_record)
        modified_seq_str = self.get_string_from_record(modified_record)
        return self.biodesign_metadata.compute_difference(original_seq_str, modified_seq_str)

    @staticmethod
    def get_string_from_record(record):
        """
        Converts a SeqRecord to a GenBank format string.
        
        Args:
            record (SeqRecord): The sequence record to convert
            
        Returns:
            str: The sequence record in GenBank format
        """
        genbank_str_io = StringIO()
        SeqIO.write(record, genbank_str_io, "genbank")
        genbank_str = genbank_str_io.getvalue()
        genbank_str_io.close()
        return genbank_str

    @staticmethod
    def save_new_record(file_name, old_record, new_seq, new_annotations, new_features):
        """
        Saves a modified sequence record to a GenBank file.
        
        This method creates a new SeqRecord with the provided sequence, annotations,
        and features, converts it to lowercase, and saves it to a GenBank file.
        
        Args:
            file_name (str): Name of the file to save to
            old_record (SeqRecord): The original sequence record
            new_seq (Seq): The new sequence
            new_annotations (dict): The new annotations
            new_features (list): The new features
            
        Returns:
            SeqRecord: The modified sequence record
        """
        file_path = f"library/{file_name}.gb"
        modified_record = SeqRecord(seq=new_seq,
                                    id=old_record.id,
                                    name=old_record.name,
                                    description=old_record.description,
                                    annotations=new_annotations,
                                    features=new_features).lower()

        # Save the modified sequence
        with open(file_path, "w") as output_handle:
            SeqIO.write(modified_record, output_handle, "genbank")
        return modified_record

    def open_sequence_and_create_metadata_if_needed(self, sequence_name: str, metadata_parent_id=""):
        """
        Opens a sequence file and creates metadata if it doesn't exist.
        
        This method loads a GenBank file and its associated metadata. If the metadata
        doesn't exist, it creates a new metadata file with the provided parent ID.
        
        Args:
            sequence_name (str): Name of the sequence file (without extension)
            metadata_parent_id (str): ID of the parent metadata (default: "")
            
        Returns:
            tuple: (SeqRecord, str) containing the sequence record and metadata path
        """
        file_path = f"library/{sequence_name}.gb"
        metadata_path = f"library/metadata_{sequence_name}.json"

        # It should always exist, except for the case of the CREATE operation
        if not os.path.exists(file_path):
            return None, metadata_path

        with open(file_path, "r") as input_handle:
            record = SeqIO.read(input_handle, "genbank")
            record = record.lower()

        # check if the metadata for the original file exists, create it if not
        if not os.path.exists(metadata_path):
            self.biodesign_metadata.create_metadata(
                parent_metadata_id=metadata_parent_id,
                design_name=sequence_name,
                author="John Smith",
                description="",
                design=str(record.seq),
            )
        return record, metadata_path
    
    
    def open_protein_and_create_metadata_if_needed(self, sequence_name: str, metadata_parent_id=""):
        """
        Opens a protein file and creates metadata if it doesn't exist.
        
        This method loads a PDB file and its associated metadata. If the metadata
        doesn't exist, it creates a new metadata file with the provided parent ID.
        
        Args:
            sequence_name (str): Name of the protein file (without extension)
            metadata_parent_id (str): ID of the parent metadata (default: "")
            
        Returns:
            tuple: (str, str) containing the PDB content and metadata path
        """
        file_path = f"library/{sequence_name}.pdb"
        metadata_path = f"library/metadata_{sequence_name}.json"

        # It should always exist, except for the case of the CREATE operation
        if not os.path.exists(file_path):
            return None, metadata_path

        with open(file_path, "r") as input_handle:
            design = input_handle.read()

        # check if the metadata for the original file exists, create it if not
        if not os.path.exists(metadata_path):
            self.biodesign_metadata.create_metadata(
                parent_metadata_id=metadata_parent_id,
                design_name=sequence_name,
                author="John Smith",
                description="",
                design=design,
            )
        return design, metadata_path
