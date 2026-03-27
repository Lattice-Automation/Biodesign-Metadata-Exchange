# Using FASTA Files as BLAST Databases

This guide explains how to use a FASTA file as a BLAST database instead of downloading large NCBI databases.

## Step 1: Format Your FASTA File

Before you can use a FASTA file with BLAST, you must format it using `makeblastdb`:

### For DNA Sequences:
```bash
makeblastdb -in your_sequences.fasta -dbtype nucl -out your_sequences
```

### For Protein Sequences:
```bash
makeblastdb -in your_sequences.fasta -dbtype prot -out your_sequences
```

**Parameters:**
- `-in`: Your input FASTA file
- `-dbtype`: `nucl` for DNA/nucleotide sequences, `prot` for protein sequences
- `-out`: Base name for the formatted database (optional, defaults to input filename)

This will create several files:
- `your_sequences.nhr`, `your_sequences.nin`, `your_sequences.nsq` (for nucleotide)
- `your_sequences.phr`, `your_sequences.pin`, `your_sequences.psq` (for protein)

## Step 2: Use the Formatted Database

Once formatted, you can use the database in two ways:

### Option A: Use Full Path
Provide the full path to the database (without the `.fasta` extension):

```json
{
  "sequence": "ATGCGATCG...",
  "sequenceType": "dna",
  "database": "/full/path/to/your_sequences"
}
```

### Option B: Use Relative Path
Provide a relative path from the current working directory:

```json
{
  "sequence": "ATGCGATCG...",
  "sequenceType": "dna",
  "database": "./path/to/your_sequences"
}
```

**Important:** Always use the database name **without** the `.fasta` extension. BLAST expects the base name of the formatted database files.

## Example Workflow

1. **Create or obtain a FASTA file:**
   ```bash
   cat > my_sequences.fasta << EOF
   >seq1
   ATGCGATCGATCGATCG
   >seq2
   GCTAGCTAGCTAGCTAG
   EOF
   ```

2. **Format it as a BLAST database:**
   ```bash
   makeblastdb -in my_sequences.fasta -dbtype nucl -out my_sequences
   ```

3. **Use it in the BLAST API:**
   - Database parameter: `/full/path/to/my_sequences` (no extension)
   - Or: `./my_sequences` if in the same directory

## Troubleshooting

### "Database not found" error
- Make sure you've run `makeblastdb` first
- Check that all the database files (`.nhr`, `.nin`, `.nsq` for nucleotide) exist
- Use the database path **without** the `.fasta` extension
- Use absolute paths if relative paths don't work

### "Cannot open database" error
- Verify the database files are in the same directory
- Check file permissions
- Make sure you're using the base name (without extension) that you specified with `-out`

## Notes

- The formatted database files must remain in the same directory
- You only need to run `makeblastdb` once per FASTA file
- If you update your FASTA file, you'll need to reformat it
- Formatted databases are typically much larger than the original FASTA file
