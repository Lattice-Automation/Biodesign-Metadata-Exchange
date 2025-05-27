import sys
import json
import os
sys.path.append('.')
sys.path.append('./biodesign-library/python')
from LatticeDesignTool import LatticeDesignTool
from Bio import SeqIO


def get_current_design_name(state):
    """
    Get the current design name from the metadata file if it exists.
    
    Args:
        state (dict): The current state containing the file name
        
    Returns:
        str: The design name from metadata, or "<None>" if not found
        
    Note:
        This function attempts to read the metadata file for the current
        design and extract the designName field. If any errors occur or
        the file doesn't exist, it returns "<None>".
    """
    if not state['current_file_name']:
        return "<None>"
    
    metadata_path = f"library/metadata_{state['current_file_name']}.json"
    if not os.path.exists(metadata_path):
        return "<None>"
        
    try:
        with open(metadata_path, "r") as f:
            metadata = json.load(f)
            return metadata.get("designName", "<None>")
    except Exception:
        return "<None>"


def print_help():
    """
    Print help information for the BioDesign tool.
    
    Displays information about:
    - Available commands and their case sensitivity
    - Command argument format
    - File location requirements
    - How to establish a current design
    - Auxiliary commands
    """
    print(" - Commands (case-sensitive): IMPORT, CREATE, OPEN, INSERT, APPEND, ADD_ANNOTATION, CODON_OPTIMIZATION, SPLIT, EXPORT, COPY, PASTE, DELETE")
    print(" - Enter command to see its arguments, then enter COMMAND argument_name=value to pass arguments (see biodesign-tool/operations folder for more details).")
    print(" - Files must be placed/CREATEd/IMPORTed into the 'library' folder. Exclude file extensions in all command arguments (except for IMPORT).")
    print(" - Start with IMPORT, CREATE, or OPEN to establish a 'current' design on which other operations will be performed, e.g. OPEN file_name=sample_seq")
    print(" - (Auxiliary commands, requiring no arguments: help, close, print, exit)")


def run_lattice_design_tool():
    """
    Run the main BioDesign tool interface.
    
    This function:
    1. Initializes the LatticeDesignTool
    2. Enters an interactive loop that:
       - Displays the current design name
       - Accepts user commands
       - Handles special commands (exit, close, print, help)
       - Executes biological design operations
    3. Manages the tool's state and error handling
    
    Note:
        The tool runs until the user enters 'exit' or encounters an unrecoverable error.
        All operations are executed through the LatticeDesignTool instance.
    """
    print("\n\nWelcome to the BioDesign tool!")
    print_help()

    cad = LatticeDesignTool()

    while True:
        current_design = get_current_design_name(cad.state)
        cmd = input(f"\nCurrent Design: {current_design}\nEnter a command: ")
        
        # Handle special commands that don't need argument parsing
        if cmd == "exit":
            break
        elif cmd == "close":
            cad.state['current_file_name'] = None
            cad.state['current_metadata_id'] = None
            cad.state['clipboard'] = {'text': None, 'copied_from': None}
            print("Current design closed. Use IMPORT, CREATE, or OPEN to work with a new sequence.")
            continue
        elif cmd == "print":
            if not cad.state['current_file_name']:
                print("Error: No current design is open. Please use IMPORT, CREATE, or OPEN first.")
                continue

            try:
                # Read and display metadata
                metadata_path = f"library/metadata_{cad.state['current_file_name']}.json"
                with open(metadata_path, "r") as f:
                    metadata = json.load(f)
                    print("\nMetadata Information:")
                    print(f"Design Name: {metadata.get('designName', 'N/A')}")
                    print(f"Author: {metadata.get('author', 'N/A')}")
                    print(f"Description: {metadata.get('description', 'N/A')}")
                    print(f"Last Updated: {metadata.get('lastUpdated', 'N/A')}")
                    print(f"Number of Operations: {len(metadata.get('changelog', []))}")

                # Read and display sequence information
                file_path = f"library/{cad.state['current_file_name']}.gb"
                with open(file_path, "r") as f:
                    record = SeqIO.read(f, "genbank")
                    print("\nSequence Information:")
                    print(f"Length: {len(record.seq)} bp")
                    print(f"Number of Annotations: {len(record.features)}")
                    print(f"Annotations: {', '.join(str(feature.qualifiers['label']) for feature in record.features) if record.features else 'None'}")
            except Exception as e:
                print(f"Error reading design information: {e}")
            continue
        elif cmd == "help":
            print_help()
            continue
        else:
            # Handle regular operations that need argument parsing
            cmd_and_args = parse_cmd_and_args(cmd)
            if not cmd_and_args:
                continue
            cmd_name, cmd_args = cmd_and_args
            try:
                cad.execute_operation(cmd_name, **cmd_args)
            except ValueError as e:
                print(f"Error: {e}")


def parse_cmd_and_args(cmd):
    """
    Parse a command string into its name and arguments.
    
    Args:
        cmd (str): The command string to parse
        
    Returns:
        tuple: (command_name, command_args) if parsing successful, None otherwise
        
    Note:
        The command string should be in the format:
        "COMMAND_NAME arg1=value1 arg2=value2"
        Arguments are separated by spaces and use = for assignment.
    """
    try:
        name_and_args = cmd.split(" ")
        cmd_name = name_and_args[0]
        cmd_args = {}
        if len(name_and_args) > 1:
            for arg in name_and_args[1:]:
                arg_name, arg_value = arg.split("=")
                cmd_args[arg_name] = arg_value
        return cmd_name, cmd_args
    except Exception:
        print(f"Invalid cmd format. Use argument_name=value to pass arguments and separate them by single spaces")


if __name__ == '__main__':
    run_lattice_design_tool()
