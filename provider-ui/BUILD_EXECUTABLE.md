# Building Standalone Executable

This guide explains how to build a standalone executable for the Biodesign Metadata Tool that includes all dependencies and can run without requiring Node.js to be installed.

## Prerequisites

You need Node.js and npm installed on your system to build the executable:

```bash
node --version  # Should be v16 or higher
npm --version
```

## Building the Executable

### Step 1: Install Dependencies

```bash
cd provider-ui
npm install
```

### Step 2: Build the Executable

Run the build script which will:
1. Build the React application
2. Package everything into standalone executables

```bash
npm run build:executable
```

This will create executables in the `dist/` directory:
- `provider-ui-win-x64.exe` (Windows)
- `provider-ui-macos-x64` (macOS)
- `provider-ui-linux-x64` (Linux)

### Step 3: Distribute the Executable

The executable files in the `dist/` directory are completely standalone and can be distributed to users. Each executable:
- Contains all Node.js dependencies
- Includes the built React application
- Can run without requiring Node.js installation
- Automatically opens a browser window when started

## Running the Executable

Users can simply double-click the executable (or run it from the command line):

**Windows:**
```bash
provider-ui-win-x64.exe
```

**macOS/Linux:**
```bash
./provider-ui-macos-x64
# or
./provider-ui-linux-x64
```

The application will:
1. Start a local web server
2. Automatically open a browser window to `http://localhost:3000`
3. Display the Biodesign Metadata Tool interface

To stop the server, press `Ctrl+C` in the terminal (or close the terminal window).

## Building for Specific Platforms

If you only want to build for a specific platform, you can modify the `package:executable` script in `package.json`:

**Windows only:**
```json
"package:executable": "pkg . --targets node18-win-x64 --output-path dist"
```

**macOS only:**
```json
"package:executable": "pkg . --targets node18-macos-x64 --output-path dist"
```

**Linux only:**
```json
"package:executable": "pkg . --targets node18-linux-x64 --output-path dist"
```

## Build Warnings

When building the executable, you may see warnings like:
- "Failed to make bytecode" - These are harmless. `pkg` tries to optimize some files but falls back to including them normally if optimization fails.
- "Cannot include file xdg-open" - This is related to browser opening on Linux. The app will still work; browser opening may just not work automatically on Linux.

These warnings do not affect the functionality of the executable. The build process completes successfully despite these warnings.

## Troubleshooting

### Executable is large
The executable includes Node.js runtime and all dependencies, so it will be ~50-100MB. This is normal.

### Port already in use
If port 3000 is already in use, the executable will fail to start. You can modify `server.js` to use a different port, or kill the process using port 3000.

### Browser doesn't open automatically
The automatic browser opening is a convenience feature. If it doesn't work (especially on Linux), users can manually navigate to `http://localhost:3000` in their browser.

### Antivirus warnings
Some antivirus software may flag executables created with `pkg` as suspicious. This is a false positive. You may need to:
- Add an exception for the executable
- Sign the executable with a code signing certificate (for production distribution)

## File Structure

After building, your directory structure will look like:

```
provider-ui/
├── dist/
│   ├── provider-ui-win-x64.exe
│   ├── provider-ui-macos-x64
│   └── provider-ui-linux-x64
├── build/          # React build output (used by executable)
├── server.js       # Server script (packaged in executable)
└── package.json
```

The `dist/` directory contains the distributable executables.
