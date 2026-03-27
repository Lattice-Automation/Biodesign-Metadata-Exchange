"""
BioDesign Provider Server

This module implements a Flask-based web server that provides endpoints for
validating biological designs and retrieving their revision histories. The server
uses the biodesign-metadata package for evaluation.

Key Features:
- Design and metadata validation endpoint
- Revision history retrieval endpoint
- CORS support for cross-origin requests
- Error handling and response formatting
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os
import uuid

# Ensure biodesign-library/python is on path for package import
_script_dir = os.path.dirname(os.path.abspath(__file__))
_repo_root = os.path.dirname(_script_dir)
_biodesign_python = os.path.join(_repo_root, 'biodesign-library', 'python')
if _biodesign_python not in sys.path:
    sys.path.insert(0, _biodesign_python)

from biodesign_metadata import MetadataEvaluator
from blast_utils import run_blast_search

app = Flask(__name__)
CORS(app)

# Create upload directory if it doesn't exist
UPLOAD_FOLDER = 'provider-uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@app.route('/upload', methods=['POST'])
def upload_files():
    """
    Endpoint for uploading design and metadata files.
    
    This endpoint:
    1. Accepts design and metadata files via multipart/form-data
    2. Saves files to the provider-uploads directory with unique names
    3. Returns the saved filenames for use in subsequent requests
    
    Request:
        multipart/form-data with:
        - designFile: The design file (GenBank or PDB)
        - metadataFile: The metadata file (encrypted text)
        
    Returns:
        JSON response with:
        - error: Boolean indicating success/failure
        - message: Description of the result (if error)
        - designFilePath: Saved design filename (if success)
        - metadataFilePath: Saved metadata filename (if success)
        
    Status Codes:
        - 200: Success
        - 400: Missing required files or invalid filenames
        - 500: Server error during file save operation
    """
    if 'designFile' not in request.files or 'metadataFile' not in request.files:
        return jsonify({
            'error': True,
            'message': 'Both design file and metadata file are required.'
        }), 400
    
    design_file = request.files['designFile']
    metadata_file = request.files['metadataFile']
    
    if design_file.filename == '' or metadata_file.filename == '':
        return jsonify({
            'error': True,
            'message': 'Both design file and metadata file must have valid filenames.'
        }), 400
    
    # Generate unique filenames to avoid conflicts
    unique_id = str(uuid.uuid4())
    
    # Get original file extensions
    design_ext = os.path.splitext(design_file.filename)[1] or '.gb'
    metadata_ext = os.path.splitext(metadata_file.filename)[1] or '.txt'
    
    # Create secure unique filenames
    design_filename = f"{unique_id}_design{design_ext}"
    metadata_filename = f"{unique_id}_metadata{metadata_ext}"
    
    design_path = os.path.join(UPLOAD_FOLDER, design_filename)
    metadata_path = os.path.join(UPLOAD_FOLDER, metadata_filename)
    
    try:
        # Save files
        design_file.save(design_path)
        metadata_file.save(metadata_path)
        
        return jsonify({
            'error': False,
            'designFilePath': design_filename,
            'metadataFilePath': metadata_filename
        }), 200
    except Exception as e:
        return jsonify({
            'error': True,
            'message': f'Failed to save files: {str(e)}'
        }), 500


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

    design_full_path = os.path.join(UPLOAD_FOLDER, design_file)
    metadata_full_path = os.path.join(UPLOAD_FOLDER, metadata_file)

    if not os.path.exists(design_full_path) or not os.path.exists(metadata_full_path):
        return jsonify({
            'error': True,
            'message': 'Uploaded files not found. Please upload files again.'
        }), 400

    evaluator = MetadataEvaluator()
    result = evaluator.evaluate(design_full_path, metadata_full_path)
    if not result.success:
        return jsonify({
            'error': True,
            'message': result.error or 'Design file and metadata file do not match. Please upload matching files.'
        }), 200

    return jsonify({
        'error': False,
        'message': "Order placed successfully."
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

    design_full_path = os.path.join(UPLOAD_FOLDER, design_file)
    metadata_full_path = os.path.join(UPLOAD_FOLDER, metadata_file)

    if not os.path.exists(design_full_path) or not os.path.exists(metadata_full_path):
        return jsonify({
            'error': True,
            'message': 'Uploaded files not found. Please upload files again.'
        }), 400

    evaluator = MetadataEvaluator()
    result = evaluator.evaluate(design_full_path, metadata_full_path)
    if not result.success:
        return jsonify({
            'error': True,
            'message': result.error or 'Design file and metadata file do not match. Please upload matching files.'
        }), 200

    # Return format expected by consumers (matches previous LatticeSynthProviderTool.compute_revisions)
    return jsonify({
        'id': result.metadata_id,
        'parentMetadataId': result.parent_metadata_id or '',
        'designName': result.design_name or '',
        'author': result.author or '',
        'description': result.description or '',
        'lastUpdated': result.last_updated or '',
        'revisions': [r.to_dict() for r in result.revisions],
    })


@app.route('/blast', methods=['POST'])
def blast_search():
    """
    Endpoint for performing BLAST searches against local databases.
    
    This endpoint:
    1. Accepts sequence data and type (DNA or protein)
    2. Runs BLAST+ search against a local database
    3. Returns formatted results
    
    Request Body:
        JSON object containing:
        - sequence: The query sequence (DNA or protein)
        - sequenceType: 'dna' or 'protein'
        - database: (optional) Database name or path to formatted BLAST database file.
                    Can be:
                    - Standard database name (e.g., 'nt', 'nr') - defaults to 'nt' for DNA, 'nr' for protein
                    - Path to formatted database (e.g., '/path/to/my_db.fasta' or '/path/to/my_db')
                    - Note: FASTA files must be formatted first using makeblastdb
        - maxHits: (optional) Maximum number of hits to return (default: 5)
        - evalue: (optional) E-value threshold (default: 10.0)
        
    Returns:
        JSON response with:
        - error: Boolean indicating success/failure
        - message: Description of the result (if error)
        - hits: List of BLAST hits with alignment information (if success)
        - queryLength: Length of query sequence
        - program: BLAST program used
        - database: Database name used
        
    Status Codes:
        - 200: Success or error response
        - 400: Missing required parameters
    """
    data = request.get_json()
    
    if not data:
        return jsonify({
            'error': True,
            'message': 'Request body is required.'
        }), 400
    
    sequence = data.get('sequence')
    sequence_type = data.get('sequenceType')
    
    if not sequence:
        return jsonify({
            'error': True,
            'message': 'Sequence is required.'
        }), 400
    
    if not sequence_type:
        return jsonify({
            'error': True,
            'message': 'sequenceType is required (must be "dna" or "protein").'
        }), 400
    
    if sequence_type.lower() not in ['dna', 'protein']:
        return jsonify({
            'error': True,
            'message': 'sequenceType must be "dna" or "protein".'
        }), 400
    
    # Get optional parameters
    database = data.get('database')
    max_hits = data.get('maxHits', 5)
    evalue = data.get('evalue', 10.0)
    
    # Run BLAST search
    result = run_blast_search(
        sequence=sequence,
        sequence_type=sequence_type,
        database=database,
        max_hits=max_hits,
        evalue=evalue
    )
    
    if not result['success']:
        return jsonify({
            'error': True,
            'message': result['error'],
            'queryLength': result.get('query_length', 0),
            'program': result.get('program'),
            'database': result.get('database')
        }), 200
    
    return jsonify({
        'error': False,
        'hits': result['hits'],
        'queryLength': result['query_length'],
        'program': result['program'],
        'database': result['database']
    }), 200


if __name__ == '__main__':
    """
    Start the Flask development server.
    
    The server runs on all interfaces (0.0.0.0) on port 8000
    with debug mode enabled for development.
    """
    app.run(debug=True, host='0.0.0.0', port=8000)
