"""
BioDesign Provider Server

This module implements a Flask-based web server that provides endpoints for
validating biological designs and retrieving their revision histories. The server
acts as an interface between clients and the Lattice Synthesis Provider Tool.

Key Features:
- Design and metadata validation endpoint
- Revision history retrieval endpoint
- CORS support for cross-origin requests
- Error handling and response formatting
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sys

sys.path.append('.')
sys.path.append('./biodesign-library/python')
from LatticeSynthProviderTool import LatticeSynthesisProviderTool

app = Flask(__name__)
CORS(app)


@app.route('/order', methods=['POST'])
def place_order():
    """
    Endpoint for placing a synthesis order.
    
    This endpoint:
    1. Validates the presence of required files
    2. Verifies that the design matches its metadata
    3. Returns a success or error response
    
    Request Body:
        JSON object containing:
        - designFilePath: Path to the design file
        - metadataFilePath: Path to the metadata file
        
    Returns:
        JSON response with:
        - error: Boolean indicating success/failure
        - message: Description of the result
        
    Status Codes:
        - 200: Success or validation failure
        - 400: Missing required files
    """
    data = request.get_json()

    # Extract design file and metadata file from the request body
    design_file = data.get('designFilePath')
    metadata_file = data.get('metadataFilePath')
    if not design_file or not metadata_file:
        return jsonify({
            'error': True,
            'message': 'Both design file and metadata file are required.'
        }), 400

    provider_tool = LatticeSynthesisProviderTool()
    # Check if design and metadata match
    design_full_path = f"exported/{design_file}"
    metadata_full_path = f"exported/{metadata_file}"
    if not provider_tool.design_and_metadata_match(design_full_path, metadata_full_path):
        return jsonify({
            'error': True,
            'message': 'Design file and metadata file do not match. Please upload matching files.'
        }), 200

    # Simulate success response
    return jsonify({
        'error': False,
        'message': f"Order placed successfully."
    }), 200


@app.route('/revisions', methods=['POST'])
def get_revisions():
    """
    Endpoint for retrieving a design's revision history.
    
    This endpoint:
    1. Validates the presence of required files
    2. Verifies that the design matches its metadata
    3. Computes and returns the revision history
    
    Request Body:
        JSON object containing:
        - designFilePath: Path to the design file
        - metadataFilePath: Path to the metadata file
        
    Returns:
        JSON response with:
        - error: Boolean indicating success/failure
        - message: Description of the result (if error)
        - design metadata and revision history (if success)
        
    Status Codes:
        - 200: Success or validation failure
        - 400: Missing required files
    """
    data = request.get_json()

    design_file = data.get('designFilePath')
    metadata_file = data.get('metadataFilePath')
    if not design_file or not metadata_file:
        return jsonify({
            'error': True,
            'message': 'Both design file and metadata file are required.'
        }), 400

    provider_tool = LatticeSynthesisProviderTool()
    # Check if design and metadata match
    design_full_path = f"exported/{design_file}"
    metadata_full_path = f"exported/{metadata_file}"
    if not provider_tool.design_and_metadata_match(design_full_path, metadata_full_path):
        return jsonify({
            'error': True,
            'message': 'Design file and metadata file do not match. Please upload matching files.'
        }), 200

    return jsonify(provider_tool.compute_revisions(design_full_path, metadata_full_path))


if __name__ == '__main__':
    """
    Start the Flask development server.
    
    The server runs on all interfaces (0.0.0.0) on port 8000
    with debug mode enabled for development.
    """
    app.run(debug=True, host='0.0.0.0', port=8000)
