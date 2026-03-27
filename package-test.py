from biodesign_metadata import MetadataEvaluator

# Load the sample file and metadata files
sample_file_path = "samples/example-1/sample_seq.fasta"
sample_metadata_path = "samples/example-1/metadata_sample_seq.json"
# sample_metadata_path = "samples/example-1/metadata_sample_seq.txt"  # If metadata is encrypted, it will be decrypted; BMDE_ENCRYPTION_KEY must be set


# Parse and evaluate the design
evaluator = MetadataEvaluator()
result = evaluator.evaluate(sample_file_path, sample_metadata_path)
if not result.success:
    print(f"Evaluation failed: {result.error}")
    raise SystemExit(1)

out_path = evaluator.save_to_output_folder(result, sample_file_path, sample_metadata_path)
print(f"Output written to: {out_path}")
print(result.summary.to_json())

# Update results with screening info
example_screening_results = {
    "sample_seq_rev1": {
        "regulatory_status": "controlled",
        "findings": {
            "us_ccl_export_control": {"reason_code": "FAIL"},
            "eu_dual_use_export_control": {"reason_code": "FAIL"},
            "us_screening_framework": {"reason_code": "FAIL"},
        },
    },
    "sample_seq": {
        "regulatory_status": "not_controlled",
        "findings": {
            "us_ccl_export_control": {"reason_code": "PASS"},
            "eu_dual_use_export_control": {"reason_code": "PASS"},
            "us_screening_framework": {"reason_code": "PASS"},
        },
    },
}
updated = evaluator.update_results_with_screening(
    result, example_screening_results,
    results_path=f"{out_path}/results.json"
)
print(updated.summary.to_json())
