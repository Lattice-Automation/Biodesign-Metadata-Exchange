# Biodesign Metadata Exchange (BMDE) – Code Repository

This repository contains code for the **Biodesign Metadata Exchange (BMDE)**, a proposed standard for capturing and storing metadata about biological designs. The standard is being developed as a collaboration between **NTI | bio** and **Lattice Automation** to enhance biosecurity in synthetic biology and AI-driven biodesign tools.

## **What is the BMDE Standard?**

BMDE allows biodesign tools to record metadata—including design provenance, modifications, and authorship—so that synthesis providers and other stakeholders can verify the origin and intent of a biological design.

This repository provides:

- **Core Libraries** for integrating BMDE into biodesign tools.
- **Demonstration Tools** to illustrate how BMDE can be used.
- **Example Metadata and Use Cases** for testing.

---

## **Who Should Use This Repository?**

- **Biodesign Tool Developers** – If you develop tools for DNA/protein design, this repository provides libraries to integrate BMDE into your software.
- **Synthesis Providers** – If you manufacture synthetic DNA or proteins, the tools here show how BMDE can be used to screen orders.
- **Synthesis Screening Providers** - If you develop DNA synthesis screening tools, this repository provides example metadata you can use to develop tools that help synthesis providers interpret metadata in a screening context.
- **Policy and Security Researchers** – If you are evaluating biosecurity standards, this repository contains demonstration tools and example metadata.

---

## **How Should You Use This Repository?**

If you are one of the users mentioned in the previous section and you want to incorporate metadata into your tool—whether that is for creating or for interpreting—the high-level steps you should follow are:

- Install the requirements
- Choose the BMDE library for the language you are using
- Import the library into your code
- Use the library to create and update metadata for the entities, or to read and interpret it.

A basic example of how to do this is outlined in the [Using the BMDE Library](#**Using-the-BMDE-Library**) section.

---

## **Repository Structure**

| Folder                                 | Purpose                                                                                                                     |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `biodesign-library`                  | **Core BMDE library** (Python complete, TypeScript/Java incomplete). Use this to integrate BMDE into your tools.      |
| `biodesign-tool`                     | **Demo command-line tool** for tracking metadata during DNA/protein design. Intended as an example, not for real use. |
| `library` & `exported`             | **Example metadata and sequence files** used in the demo tools.                                                       |
| `provider-backend` & `provider-ui` | **Demo synthesis provider system** that validates orders using BMDE metadata. Not for production use.                 |

> ⚠️ **Work in Progress**: The BMDE standard is still evolving. This codebase is for exploration and prototyping, not for production deployment.

---

## **Using the BMDE Library**

### **Python Library (Recommended)**

To install (recommendation: do this in a [virtual environment](https://packaging.python.org/en/latest/guides/installing-using-pip-and-virtual-environments/)):

```bash
pip install -r requirements.txt
pip install -e ./biodesign-library
```

Before using the library, set up your encryption key:

1. Open the `.env` file in the `/biodesign-library` directory
2. Add your encryption key in the format: `BMDE_ENCRYPTION_KEY=your_secret_key_here`. An example encryption key is commented out in the `.env` file.

**Creating metadata** – For an example of how to create a design, modify it, and track the metadata:

```bash
python basic_sample.py
```

**Evaluating metadata** – Synthesis providers can use `MetadataEvaluator` to validate orders and interpret design history:

```python
from biodesign_metadata import MetadataEvaluator

evaluator = MetadataEvaluator()  # Uses BMDE_ENCRYPTION_KEY from env
result = evaluator.evaluate(design_path="order.gb", metadata_path="metadata.txt")

if result.success:
    print(f"Design: {result.design_name}, Revisions: {len(result.revisions)}")
    evaluator.export_for_viewer(result, "evaluation_result.json")
else:
    print(f"Evaluation failed: {result.error}")
```

The evaluator accepts encrypted metadata (`.txt`) or plain JSON metadata (`.json`).

**Custom rules** – Providers can use their own rules by setting `BMDE_RULES_CONFIG` to the path of a JSON file, or by passing `rules_config_path` to `MetadataEvaluator`:

```python
evaluator = MetadataEvaluator(rules_config_path="/path/to/my_rules.json")
# Or: export BMDE_RULES_CONFIG=/path/to/my_rules.json
```

The rules file should match the structure of the default rules (see `biodesign-library/python/biodesign_metadata/config/default_rules.json`). Each rule can include `autoScreen: true` to add an "Auto-screening recommended" comment when that rule flags a revision (for integration with screening results later).

**Output folder** – Set `BMDE_OUTPUT_DIR` to a directory path. Call `evaluator.save_to_output_folder(result, design_path, metadata_path)` after a successful evaluation to write a timestamped subfolder containing the design file, encrypted and unencrypted metadata, results JSON, and a FASTA of sequences recommended for screening.

### **TypeScript and Java Libraries (In Progress)**

These libraries are still under development but will provide the same functionality as the Python version.

---

## **Demonstration Tools**

### **1. BMDE Design Tool (Command Line)**

Demonstrates how BMDE metadata is generated during a biodesign workflow.

To run:

```bash
python biodesign-tool/main-biodesign.py
```

Example workflow:

1. Create a GenBank sequence: CREATE file_name=test sequence=acgtacgtacgt
2. Insert another sequence: INSERT insert_sequence=aaaaa insert_position=5
3. Add an annotation: ADD_ANNOTATION annotation_name=CDS annotation_start_index=5 annotation_end_index=10
4. Export sequence and metadata: EXPORT include_metadata=True

Various other operations can also be performed, such as codon optimizing, splitting, copying/pasting, etc.  Type the name of the command

**Note**: The genbank files need to be placed (or IMPORTed) into the "library" folder, and for all commands (except IMPORT), file names must be specified without the extension.  Once a 'current' sequence is established with IMPORT, CREATE, or OPEN, subsequent commands will be performed on that sequence.

You can find more info about each command by looking at the docstrings/documentation in each file in the biodesign-tool/operations folder.

The tool will show you some additional instructions. Enter 'help' to see the instructions at any time.

**Automated Use Cases:**
To run pre-defined workflows:

```bash
python biodesign-tool/run-use-cases-biodesign.py
```

This will ask you for the JSON file that contains the use case to run. The JSON file must be present in the "biodesign-tool/use-cases" folder. You can run multiple use cases in a row by concatenating the use case file names with a comma.

The "biodesign-tool/use-cases" folder contains some example use cases that can already be run and taken as a template to create new use cases.

Note: When use case files share states, they must be run together in the same session, for example, if use_case_1.json makes a COPY operation and use_case_2.json makes a PASTE opertaion, they have to be run as `use_case_1,use_case2` so that the PASTE operation has something in the clipboard from the first use case COPY operation.

---

### **2. BMDE Synthesis Provider Tool (Web Application)**

Simulates a DNA synthesis provider verifying an order using BMDE metadata.

#### **Running the Provider Backend**

```bash
python provider-backend/provider-server.py
```

#### **Running the Provider Frontend (in a new terminal)**

```bash
cd provider-ui
npm install
npm start
```

Note: The genbank and metadata files need to be in the "exported" folder.

#### **BLAST Search Setup (Optional)**

The provider tool includes BLAST search functionality to search sequences against local databases. To use this feature:

1. **Install BLAST+**: Download and install BLAST+ from [NCBI](https://ftp.ncbi.nlm.nih.gov/blast/executables/blast+/LATEST/). Make sure the BLAST+ executables (`blastn`, `blastp`) are in your system PATH.

2. **Set up BLAST Databases**: Download and set up local BLAST databases:
   - For DNA sequences: Download the `nt` (nucleotide) database
   - For protein sequences: Download the `nr` (non-redundant protein) database
   - Databases can be downloaded from [NCBI BLAST databases](https://ftp.ncbi.nlm.nih.gov/blast/db/)
   - Use `update_blastdb.pl` (included with BLAST+) to download databases automatically

3. **Configure Database Path (Optional)**: If your databases are not in the default location, set the `BLAST_DB_PATH` environment variable:
   ```bash
   export BLAST_DB_PATH=/path/to/your/blast/databases
   ```

4. **Usage**: Once set up, select a sequence in the Revision Details panel and click the "BLAST Version" button. Results will be automatically added as a comment to the revision.

**Note**: BLAST searches require significant computational resources and may take several minutes for long sequences or large databases.

#### **Example Workflow**

1. Try submitting an order **without metadata** (e.g. only sample_seq.gb from exported folder) → **Fails**
2. Directly modify/resubmit the sequence but submit the original metadata (e.g. metadata_sample_seq.txt) → **Fails (checksum mismatch)**
3. Undo the edit and resubmit the original sequence (with the matching metadata) → **Succeeds**
4. Use the `/admin` page (i.e. localhost:3000/admin) to view **design history** and **modifications**

---

## **How to Integrate BMDE in Your Own Tools**

1. **Use the Python BMDE Library** – `pip install -e ./biodesign-library` installs the `biodesign-metadata` package for both creating and evaluating metadata.
2. **Export Metadata with Every Design Change** – Track operations like insertions, deletions, and optimizations.
3. **Ensure Metadata Integrity** – BMDE uses encrypted JSON files with checksums to prevent tampering.
4. **Adopt BMDE in Screening Workflows** – Synthesis providers can use `MetadataEvaluator.evaluate()` to verify design-metadata integrity, apply rules, and export evaluation results.

For questions, reach out to:

- Programming Support - guzman@latticeautomation.com
- Technical Direction - doug@latticeautomation.com

---

## **Next Steps**

- **Provide Feedback**: We are actively refining BMDE based on community input.
- **Contribute**: Pull requests are welcome!
- **Stay Updated**: The standard is evolving—check for updates.
