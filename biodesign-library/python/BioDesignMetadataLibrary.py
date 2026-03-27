"""
Backward compatibility shim for BioDesignMetadataLibrary.
Imports from the biodesign_metadata package in this directory.
"""

import sys
from pathlib import Path

# Ensure python/ is on path so biodesign_metadata can be found
_python_dir = Path(__file__).resolve().parent
if str(_python_dir) not in sys.path:
    sys.path.insert(0, str(_python_dir))

from biodesign_metadata.core import (
    BioDesignMetadata,
    BioDesignMetadataLibrary,
    BioDesignOperation,
)

__all__ = ["BioDesignMetadataLibrary", "BioDesignMetadata", "BioDesignOperation"]
