from BioDesignMetadataLibrary import BioDesignMetadataLibrary
from operations.InsertOperation import InsertOperation
from operations.ImportOperation import ImportOperation
from operations.AppendOperation import AppendOperation
from operations.CodonOptimizeOperation import CodonOptimizeOperation
from operations.CreateOperation import CreateOperation
from operations.ExportOperation import ExportOperation
from operations.DeleteOperation import DeleteOperation
from operations.AddAnnotationOperation import AddAnnotationOperation
from operations.SplitOperation import SplitOperation
from operations.CopyOperation import CopyOperation
from operations.PasteOperation import PasteOperation
from operations.OpenOperation import OpenOperation
from operations.OpenProteinOperation import OpenProteinOperation
from operations.ExtractBackboneOperation import ExtractBackboneOperation
from operations.CreateProteinOperation import CreateProteinOperation
from operations.ExportProteinOperation import ExportProteinOperation
from operations.RedesignInterfaceOperation import RedesignInterfaceOperation
from operations.DesignProteinOperation import DesignProteinOperation
from operations.CalculateProteinMetricsOperation import CalculateProteinMetricsOperation
from operations.TranslateProteinOperation import TranslateProteinOperation

class LatticeDesignTool:
    """
    A tool for managing and executing biological design operations.
    
    This class provides a centralized interface for executing various biological
    design operations such as sequence manipulation, protein design, and metadata
    management. It maintains the current state of operations including the active
    file and clipboard contents.
    """
    
    def __init__(self):
        """
        Initialize the LatticeDesignTool with default state.
        
        Sets up the metadata library and initializes the state dictionary with
        empty current file name, clipboard, and metadata ID.
        """
        self.biodesign_metadata = BioDesignMetadataLibrary()
        self.state = {
            'current_file_name': None,
            'clipboard': {
                'text': None,
                'copied_from': None
            },
            'current_metadata_id': None
        }

    def requires_current_file(self, operation_name):
        """
        Check if an operation requires a current file to be set.
        
        Args:
            operation_name (str): The name of the operation to check
            
        Returns:
            bool: True if the operation requires a current file, False otherwise
            
        Note:
            Operations that modify existing files or require file context
            need a current file to be set before execution.
        """
        operations_requiring_file = {
            "INSERT", "DELETE", "APPEND", "CODON_OPTIMIZATION", 
            "ADD_ANNOTATION", "SPLIT", "PASTE", "COPY", "EXPORT",
            "EXTRACT_BACKBONE", "EXPORT_PROTEIN", "REDESIGN_INTERFACE", 
            "DESIGN_PROTEIN", "CALCULATE_PROTEIN_METRICS", "TRANSLATE_PROTEIN"
        }
        return operation_name in operations_requiring_file

    def execute_operation(self, operation_name, **operation_args):
        """
        Execute a biological design operation with the given arguments.
        
        This method:
        1. Creates the appropriate operation instance based on the operation name
        2. Validates that a current file is set if required
        3. Validates the operation arguments
        4. Updates the current file name if needed
        5. Executes the operation with the current state
        
        Args:
            operation_name (str): The name of the operation to execute
            **operation_args: Keyword arguments specific to the operation
            
        Note:
            - For IMPORT, CREATE, OPEN, and OPEN_PROTEIN operations, the current
              file name is updated after validation
            - Protein-related operations are executed with is_protein=True
            - The operation's execute method is called with the current state
        """
        if operation_name == "IMPORT":
            operation = ImportOperation()
        elif operation_name == "CREATE":
            operation = CreateOperation()
        elif operation_name == "OPEN":
            operation = OpenOperation()
        elif operation_name == "INSERT":
            operation = InsertOperation()
        elif operation_name == "DELETE":
            operation = DeleteOperation()
        elif operation_name == "APPEND":
            operation = AppendOperation()
        elif operation_name == "CODON_OPTIMIZATION":
            operation = CodonOptimizeOperation()
        elif operation_name == "ADD_ANNOTATION":
            operation = AddAnnotationOperation()
        elif operation_name == "SPLIT":
            operation = SplitOperation()
        elif operation_name == "PASTE":
            operation = PasteOperation()
        elif operation_name == "COPY":
            operation = CopyOperation()
        elif operation_name == "EXPORT":
            operation = ExportOperation()
        elif operation_name == "OPEN_PROTEIN":
            operation = OpenProteinOperation()
        elif operation_name == "EXTRACT_BACKBONE":
            operation = ExtractBackboneOperation()
        elif operation_name == "CREATE_PROTEIN":
            operation = CreateProteinOperation()
        elif operation_name == "EXPORT_PROTEIN":
            operation = ExportProteinOperation()
        elif operation_name == "REDESIGN_INTERFACE":
            operation = RedesignInterfaceOperation()
        elif operation_name == "DESIGN_PROTEIN":
            operation = DesignProteinOperation()
        elif operation_name == "CALCULATE_PROTEIN_METRICS":
            operation = CalculateProteinMetricsOperation()
        elif operation_name == "TRANSLATE_PROTEIN":
            operation = TranslateProteinOperation()
        else:
            print(f"Operation {operation_name} not supported")
            return

        # Check if operation requires a current file
        if self.requires_current_file(operation_name) and not self.state['current_file_name']:
            print(f"Error: {operation_name} operation requires a current file to be set. Please use IMPORT, CREATE, OPEN, OPEN_PROTEIN, or CREATE_PROTEIN first.")
            return

        # Validate arguments first
        operation.validate_and_set_args(**operation_args)
        
        # Set current_file_name after validation
        if operation_name == "IMPORT":
            self.state['current_file_name'] = operation_args.get("design_path").split("/")[-1].split(".")[0]
        elif operation_name == "CREATE":
            self.state['current_file_name'] = operation_args.get("file_name")
        elif operation_name == "OPEN":
            self.state['current_file_name'] = operation_args.get("file_name")
        elif operation_name == "OPEN_PROTEIN":
            self.state['current_file_name'] = operation_args.get("file_name")

        if operation_name == "OPEN_PROTEIN" or \
                operation_name == "EXTRACT_BACKBONE" or \
                operation_name == "CREATE_PROTEIN" or \
                operation_name == "EXPORT_PROTEIN" or \
                operation_name == "REDESIGN_INTERFACE" or \
                operation_name == "DESIGN_PROTEIN" or \
                operation_name == "CALCULATE_PROTEIN_METRICS" or \
                operation_name == "TRANSLATE_PROTEIN":
            
            operation.execute(self.state, is_protein=True)
        else:
            operation.execute(self.state)
