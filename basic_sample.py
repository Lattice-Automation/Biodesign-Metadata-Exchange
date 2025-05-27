# Import the BioDesignMetadataLibrary
import sys
sys.path.append('./biodesign-library/python')
from BioDesignMetadataLibrary import BioDesignMetadataLibrary
import json
from dataclasses import asdict

# Create the metadata library
biodesign_metadata = BioDesignMetadataLibrary()

# Create intial design
my_sequence = "ATGC"
design_name = "my-design"
author = "John Smith"
description = "This is my design"

# Create the initial metadata
metadata = biodesign_metadata.create_metadata(
    parent_metadata_id=None,
    design_name=design_name,
    author=author,
    description=description,
    design=my_sequence
)

# Print the metadata
print(f"Initial sequence: {my_sequence}")
print("Initial metadata:")
print(json.dumps(asdict(metadata), indent=4))

# Metadata will be automatically created at this location
metadata_path = f"library/metadata_{design_name}.json"

# Example operation: Modify the design by adding a stop codon
new_sequence = my_sequence + "TGA"
my_sequence = new_sequence

# Calculate the diff between the original and modified sequence
diff = biodesign_metadata.compute_difference(my_sequence, new_sequence)

# Update the metadata with the operation just made. Operation code and details can be anything that represents the operation just made.
metadata = biodesign_metadata.update_metadata_with_operation(
            metadata_path=metadata_path,
            design=my_sequence,
            operation_code="APPEND_OPERATION",
            operation_details={
                "sequence_appeneded": "TGA"
            },
            change=diff
        )

# Print the metadata
print(f"Updated sequence: {my_sequence}")
print("Updated metadata:")
print(json.dumps(asdict(metadata), indent=4))

# Second example operation: Delete the first 2 bases
new_sequence = my_sequence[2:]
my_sequence = new_sequence

# Calculate the diff between the original and modified sequence
diff = biodesign_metadata.compute_difference(my_sequence, new_sequence)

# Update the metadata with the operation just made. Operation code and details can be anything that represents the operation just made.
metadata = biodesign_metadata.update_metadata_with_operation(
            metadata_path=metadata_path,
            design=my_sequence,
            operation_code="DELETE_OPERATION",
            operation_details={
                "start_index": 0,
                "end_index": 2
            },
            change=diff
        )

# Print the metadata
print(f"Updated sequence: {my_sequence}")
print("Updated metadata:")
print(json.dumps(asdict(metadata), indent=4))
