import json
import os
import sys
sys.path.append('.')
sys.path.append('./biodesign-library/python')
from LatticeDesignTool import LatticeDesignTool
from Bio import BiopythonWarning
import warnings


def execute_use_case(cad, use_case_id):
    """
    Execute a single use case from a JSON file.
    
    This function:
    1. Loads the use case definition from a JSON file
    2. Executes each operation in sequence
    3. Handles errors and warnings appropriately
    
    Args:
        cad (LatticeDesignTool): The BioDesign tool instance
        use_case_id (str): The identifier of the use case to execute
        
    Returns:
        bool: True if the use case executed successfully, False otherwise
        
    Note:
        - The use case file should be in the biodesign-tool/use-cases directory
        - Each use case should contain a list of operations with their arguments
        - Biopython warnings are suppressed during execution
        - Returns False if files already exist or if the use case file is not found
    """
    path = f"biodesign-tool/use-cases/{use_case_id}.json"
    if not os.path.exists(path):
        print(f"File {path} not found")
        return False
        
    with open(path, "r") as input_handle:
        use_case = json.load(input_handle)
        print(f'\nRunning use case: {use_case["name"]}...\n')
        
    for operation in use_case["operations"]:
        operation_cmd = operation["operation_command"]
        operation_args = operation["operation_arguments"]

        # Ignore Biopython warnings as to not clutter the output
        with warnings.catch_warnings():
            warnings.simplefilter('ignore', BiopythonWarning)
            try:
                cad.execute_operation(operation_cmd, **operation_args)
            except ValueError as e:
                if "already exists" in str(e):
                    print(f"\nError: Cannot run use case because the resulting files already exist. Please remove existing files.")
                    return False
                raise  # Re-raise other ValueError exceptions
            
    print(f"Finished use case: {use_case['name']}\n")
    return True


def run_use_cases():
    """
    Run the BioDesign tool use case executor interface.
    
    This function:
    1. Initializes the LatticeDesignTool
    2. Enters an interactive loop that:
       - Accepts use case file names
       - Executes use cases in sequence
       - Handles errors and provides feedback
    3. Manages the execution state and error handling
    
    Note:
        - Use cases can be run individually or in sequence
        - Multiple use cases can be specified by comma-separated names
        - The tool runs until the user enters 'exit'
        - Each use case is executed in a fresh LatticeDesignTool instance
    """
    while True:
        print("\nWelcome to the BioDesign tool - Use case runner!")
        print(" - Use cases are defined in biodesign-tool/use-cases.")
        print(" - Each use case file contains a list of operations to be executed in sequence.")
        print(" - Run use cases by entering the use case file name(s), separated by commas.")
        print(" - Numbered use cases should be executed sequentially in the same run.")
        print(" - Example: sequence-obfuscation-1, sequence-obfuscation-2, sequence-obfuscation-3")
        print(" - Enter 'exit' to quit")

        cad = LatticeDesignTool()

        use_case_input = input("\nEnter the use case file name(s): ")
        if use_case_input.lower() == 'exit':
            break
            
        use_case_ids = [id.strip() for id in use_case_input.split(',')]
        
        success = True
        for use_case_id in use_case_ids:
            if use_case_id:  # Skip empty strings
                if not execute_use_case(cad, use_case_id):
                    success = False
                    break

        if success:
            print("\n\nFinished all use case runs successfully.\n")
        else:
            print("\n\nUse case run failed. Please try again.\n")


if __name__ == '__main__':
    run_use_cases()

