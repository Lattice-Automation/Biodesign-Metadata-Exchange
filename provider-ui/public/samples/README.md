# Sample Files

This directory contains sample zip files for users to try. Each zip file can contain one or more design/metadata file pairs.

## Adding Sample Files

1. Create a zip file containing your design files (`.gb`, `.gbk`, or `.pdb`) and metadata files (`.txt`).
   - For single-file samples: include one design file and one metadata file
   - For multi-file samples: include multiple design/metadata pairs (e.g., sequence-obfuscation example)
2. Place the zip file in this directory.
3. Update `samples.json` to add a new entry:

   ```json
     {
       "id": "sample_id",
       "name": "Sample Name",
       "description": "Description of the sample",
       "zipFile": "sample_id.zip"
     }
   ```
4. The sample will automatically appear in the dropdown on the home page.

## File Naming

- Zip files should be named to match the `id` in `samples.json` (e.g., `basic_sample.zip`)
- Design files inside the zip should have extensions `.gb`, `.gbk`, or `.pdb`
- Metadata files inside the zip should have extension `.txt`
- The metadata files should contain a `designName` field that matches the design filename (without extension) for proper matching
