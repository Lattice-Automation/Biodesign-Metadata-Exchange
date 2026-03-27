"""
BLAST utility functions for running BLAST searches against local databases.

This module provides functions to:
- Run BLAST+ commands (blastn for DNA, blastp for protein)
- Parse BLAST XML output using BioPython
- Format results for API responses
"""

import subprocess
import tempfile
import os
from typing import Dict, List, Optional, Tuple
from Bio.Blast import NCBIXML
from io import StringIO


def check_blast_installed() -> Tuple[bool, Optional[str]]:
    """
    Check if BLAST+ is installed and available in PATH.
    Returns:
        Tuple of (is_installed, error_message)
    """
    try:
        result = subprocess.run(
            ['blastn', '-version'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            return True, None
        else:
            return False, "BLAST+ is installed but blastn command failed"
    except FileNotFoundError:
        return False, "BLAST+ is not installed or not in PATH. Please install BLAST+ from https://ftp.ncbi.nlm.nih.gov/blast/executables/blast+/LATEST/"
    except subprocess.TimeoutExpired:
        return False, "BLAST+ version check timed out"
    except Exception as e:
        return False, f"Error checking BLAST+ installation: {str(e)}"


def determine_blast_program(sequence: str, sequence_type: str) -> str:
    """
    Determine which BLAST program to use based on sequence type.
    
    Args:
        sequence: The sequence to search
        sequence_type: 'dna' or 'protein'
        
    Returns:
        BLAST program name ('blastn' or 'blastp')
    """
    if sequence_type.lower() == 'protein':
        return 'blastp'
    else:
        return 'blastn'


def get_default_database(sequence_type: str) -> str:
    """
    Get the default database name for a sequence type.
    
    Args:
        sequence_type: 'dna' or 'protein'
        
    Returns:
        Default database name ('nt' for DNA, 'nr' for protein)
    """
    if sequence_type.lower() == 'protein':
        return 'nr'
    else:
        return 'nt'


def run_blast_search(
    sequence: str,
    sequence_type: str,
    database: Optional[str] = None,
    db_path: Optional[str] = None,
    max_hits: int = 5,
    evalue: float = 10.0
) -> Dict:
    """
    Run a BLAST search against a local database.
    
    Args:
        sequence: The query sequence (DNA or protein)
        sequence_type: 'dna' or 'protein'
        database: Database name or path to database file (without extension).
                  If it's a file path, it should point to a formatted BLAST database.
                  Defaults to 'nt' for DNA, 'nr' for protein.
        db_path: Path to BLAST database directory (optional, uses BLAST_DB_PATH env var if not provided)
        max_hits: Maximum number of hits to return (default: 5)
        evalue: E-value threshold (default: 10.0)
        
    Returns:
        Dictionary with:
        - success: Boolean indicating if search succeeded
        - error: Error message if failed
        - hits: List of hit dictionaries with alignment info
        - query_length: Length of query sequence
        - program: BLAST program used
        - database: Database name used
    """
    # Check if BLAST+ is installed
    is_installed, error_msg = check_blast_installed()
    if not is_installed:
        return {
            'success': False,
            'error': error_msg,
            'hits': [],
            'query_length': len(sequence),
            'program': None,
            'database': None
        }
    
    # Determine BLAST program
    program = determine_blast_program(sequence, sequence_type)
    
    # Get database name/path
    if not database:
        # Check for default local database in environment variable
        # This can be a path to a formatted database (without extension)
        default_local_db = os.environ.get('BLAST_DEFAULT_DB', '')
        if default_local_db:
            # Check if it exists (with or without .fasta extension)
            if os.path.exists(default_local_db) or os.path.exists(default_local_db + '.fasta'):
                database = default_local_db
            elif os.path.exists(default_local_db + '.nhr') or os.path.exists(default_local_db + '.phr'):
                # It's already a formatted database
                database = default_local_db
            else:
                # Fall back to default NCBI database
                database = get_default_database(sequence_type)
        else:
            # Try to find a database in the current directory (provider-backend)
            # Look for common database names
            current_dir = os.path.dirname(os.path.abspath(__file__))
            potential_db = os.path.join(current_dir, 'database')
            if os.path.exists(potential_db + '.nhr') or os.path.exists(potential_db + '.phr'):
                database = potential_db
            else:
                database = get_default_database(sequence_type)
    
    # Check if database is a file path (contains / or \ or ends with common extensions)
    # If it looks like a file path, use it directly; otherwise treat as database name
    is_file_path = '/' in database or '\\' in database or database.endswith(('.fa', '.fasta', '.fas'))
    
    # If it's a file path, handle it appropriately
    if is_file_path:
        # If it's an absolute path, use it directly (BLAST can handle full paths)
        if os.path.isabs(database):
            # Remove extension if present (BLAST databases don't use extensions in the -db parameter)
            if database.endswith(('.fa', '.fasta', '.fas')):
                database = database.rsplit('.', 1)[0]
            # Use the full path as database, don't set db_path
            db_path = None
        else:
            # Relative path - convert to absolute and remove extension
            abs_path = os.path.abspath(database)
            if abs_path.endswith(('.fa', '.fasta', '.fas')):
                database = abs_path.rsplit('.', 1)[0]
            else:
                database = abs_path
            db_path = None
    else:
        # It's a database name, get path from environment if not provided
        if not db_path:
            db_path = os.environ.get('BLAST_DB_PATH', '')
    
    # Clean sequence (remove whitespace, convert to uppercase)
    clean_sequence = ''.join(sequence.split()).upper()
    
    if not clean_sequence:
        return {
            'success': False,
            'error': 'Empty or invalid sequence',
            'hits': [],
            'query_length': 0,
            'program': program,
            'database': database
        }
    
    # Create temporary FASTA file for query
    with tempfile.NamedTemporaryFile(mode='w', suffix='.fa', delete=False) as query_file:
        query_file.write(f">query\n{clean_sequence}\n")
        query_file_path = query_file.name
    
    # Create temporary file for BLAST output
    with tempfile.NamedTemporaryFile(mode='w', suffix='.xml', delete=False) as output_file:
        output_file_path = output_file.name
    
    try:
        # Build BLAST command
        cmd = [
            program,
            '-query', query_file_path,
            '-db', database,
            '-out', output_file_path,
            '-outfmt', '5',  # XML format
            '-evalue', str(evalue),
            '-max_target_seqs', str(max_hits),
            '-num_threads', '1'
        ]
        
        # Add database path if provided (only for named databases, not full paths)
        # Note: db_path is set to None for file paths, so this check is sufficient
        if db_path:
            cmd.extend(['-dbpath', db_path])
        
        # Run BLAST
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        if result.returncode != 0:
            # Check for common error messages and provide helpful feedback
            stderr_lower = result.stderr.lower()
            stdout_lower = result.stdout.lower() if result.stdout else ''
            combined_output = result.stderr + '\n' + (result.stdout if result.stdout else '')
            error_msg = result.stderr
            
            # Check for memory map errors (usually means database not formatted or corrupted)
            if 'memory map' in stderr_lower or 'memory map' in stdout_lower:
                error_msg = (
                    f'BLAST database error: The database "{database}" appears to be corrupted or not properly formatted.\n'
                    f'This usually means the database needs to be formatted using makeblastdb.\n'
                    f'Try running:\n'
                    f'  makeblastdb -in {database}.fasta -dbtype {"nucl" if sequence_type.lower() == "dna" else "prot"} -out {database}\n'
                    f'Original error: {combined_output}'
                )
            elif 'no alias or index file found' in stderr_lower or 'cannot open database' in stderr_lower:
                # Check if it might be an unformatted FASTA file
                if database.endswith(('.fa', '.fasta', '.fas')) or '/' in database or '\\' in database:
                    error_msg = (
                        f'BLAST database "{database}" not found or not formatted. '
                        f'If this is a FASTA file, you must format it first using:\n'
                        f'  makeblastdb -in {database} -dbtype {"nucl" if sequence_type.lower() == "dna" else "prot"}\n'
                        f'Then use the database path (without .fasta extension) in the database parameter.\n'
                        f'Original error: {result.stderr}'
                    )
                else:
                    error_msg = (
                        f'BLAST database "{database}" not found. '
                        f'Please download the database using:\n'
                        f'  update_blastdb.pl {database}\n'
                        f'Or set BLAST_DB_PATH environment variable if databases are in a custom location.\n'
                        f'If you want to use a FASTA file, format it first with makeblastdb.\n'
                        f'Original error: {result.stderr}'
                    )
            elif 'error' in stderr_lower:
                error_msg = f'BLAST search failed: {result.stderr}'
            else:
                error_msg = f'BLAST search failed: {result.stderr}'
            
            return {
                'success': False,
                'error': error_msg,
                'hits': [],
                'query_length': len(clean_sequence),
                'program': program,
                'database': database
            }
        
        # Parse BLAST XML output
        with open(output_file_path, 'r') as f:
            blast_records = NCBIXML.parse(f)
            blast_record = next(blast_records, None)
            
            if not blast_record:
                return {
                    'success': False,
                    'error': 'No BLAST results found',
                    'hits': [],
                    'query_length': len(clean_sequence),
                    'program': program,
                    'database': database
                }
            
            hits = []
            for alignment in blast_record.alignments[:max_hits]:
                for hsp in alignment.hsps:
                    hit = {
                        'title': alignment.title,
                        'accession': alignment.accession if hasattr(alignment, 'accession') else 'N/A',
                        'length': alignment.length,
                        'evalue': hsp.expect,
                        'bit_score': hsp.bits,
                        'identity': hsp.identities,
                        'align_length': hsp.align_length,
                        'query_start': hsp.query_start,
                        'query_end': hsp.query_end,
                        'subject_start': hsp.sbjct_start,
                        'subject_end': hsp.sbjct_end,
                        'query_seq': hsp.query[:100] + '...' if len(hsp.query) > 100 else hsp.query,
                        'match_seq': hsp.match[:100] + '...' if len(hsp.match) > 100 else hsp.match,
                        'subject_seq': hsp.sbjct[:100] + '...' if len(hsp.sbjct) > 100 else hsp.sbjct,
                    }
                    hits.append(hit)
                    break  # Only take first HSP per alignment
            
            return {
                'success': True,
                'error': None,
                'hits': hits,
                'query_length': len(clean_sequence),
                'program': program,
                'database': database
            }
    
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'error': 'BLAST search timed out (exceeded 5 minutes)',
            'hits': [],
            'query_length': len(clean_sequence),
            'program': program,
            'database': database
        }
    except Exception as e:
        return {
            'success': False,
            'error': f'Error running BLAST search: {str(e)}',
            'hits': [],
            'query_length': len(clean_sequence),
            'program': program,
            'database': database
        }
    finally:
        # Clean up temporary files
        try:
            os.unlink(query_file_path)
            os.unlink(output_file_path)
        except:
            pass
