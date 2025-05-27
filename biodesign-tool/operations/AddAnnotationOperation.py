"""
AddAnnotationOperation - Adds an annotation to a sequence.

Command format:
    ADD_ANNOTATION annotation_name=name annotation_start_index=start annotation_end_index=end

Required arguments:
    annotation_name: Name of the annotation (e.g., "CDS", "promoter")
    annotation_start_index: Starting position of the annotation (1-based)
    annotation_end_index: Ending position of the annotation (inclusive)

Example:
    ADD_ANNOTATION annotation_name=CDS annotation_start_index=1 annotation_end_index=100

Notes:
    - The indices must be within the sequence bounds
    - The annotation will be added to the GenBank file
    - The metadata will be updated to track the annotation
"""

from Bio.SeqFeature import SeqFeature, FeatureLocation
from .IOperation import IOperation


class AddAnnotationOperation(IOperation):
    def __init__(self):
        super().__init__()
        self.annotation_name = None
        self.annotation_start_index = None
        self.annotation_end_index = None

    def validate_and_set_args(self, **args):
        """
        Validates and sets the arguments required for adding an annotation.
        
        This method checks that all required arguments are present and valid:
        - annotation_name: Name of the annotation
        - annotation_start_index: Starting position for the annotation
        - annotation_end_index: Ending position for the annotation
        
        Args:
            **args: Keyword arguments containing the operation parameters
            
        Raises:
            ValueError: If any required argument is missing
        """
        annotation_name = args.get("annotation_name")
        annotation_start_index = args.get("annotation_start_index")
        annotation_end_index = args.get("annotation_end_index")
        if not annotation_name or annotation_start_index is None or annotation_end_index is None:
            raise ValueError("ADD_ANNOTATION operation requires an annotation_name, annotation_start_index, and annotation_end_index")
        self.annotation_name = annotation_name
        self.annotation_start_index = int(annotation_start_index)
        self.annotation_end_index = int(annotation_end_index)

    def get_operation_args(self):
        return {
            "annotation_name": self.annotation_name,
            "annotation_start_index": self.annotation_start_index,
            "annotation_end_index": self.annotation_end_index
        }

    def get_operation_name(self):
        return "ADD_ANNOTATION"

    def get_operation_details(self):
        """
        Returns the details of the annotation operation.
        
        This method provides a dictionary containing all the parameters
        that define this specific annotation operation.
        
        Returns:
            dict: A dictionary containing the annotation name and position indices
        """
        return {
            "annotation_name": self.annotation_name,
            "annotation_start_index": self.annotation_start_index,
            "annotation_end_index": self.annotation_end_index
        }

    def pre_execute(self, state):
        return

    def post_execute(self, state, record):
        return

    def apply_operation(self, state, record, **kwargs):
        """
        Adds a new annotation to the sequence record.
        
        This method creates a new feature annotation at the specified position in the sequence
        and adds it to the record's features. The annotation is saved as a misc_feature with
        a label qualifier.
        
        Args:
            state (dict): The current state containing the file name
            record (SeqRecord): The sequence record to annotate
            **kwargs: Additional keyword arguments
            
        Returns:
            SeqRecord: The modified sequence record with the new annotation
        """
        new_feature = SeqFeature(
            FeatureLocation(self.annotation_start_index, self.annotation_end_index),
            type="misc_feature",
            qualifiers={"label": self.annotation_name}
        )
        new_features = record.features.copy()
        new_features.append(new_feature)
        new_record = self.save_new_record(state['current_file_name'], record, record.seq, record.annotations, new_features)
        return new_record
