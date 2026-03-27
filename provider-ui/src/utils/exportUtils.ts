/**
 * Utility functions for exporting metadata and design files
 */

import JSZip from 'jszip';
import { 
  LatticeSynthesisProviderTool, 
  BioDesignMetadata, 
  BioDesignOperation,
  Revision,
  ComputeRevisionsResponse,
  calculateChecksum,
  extractSequenceFromGenBank,
  extractSequenceFromFASTA,
} from '../ProviderTool';
import { getEncryptionKey } from './settings';
import { toast } from 'react-toastify';
import { TOAST_MESSAGES } from './constants';

/**
 * Exports the current state (with modifications) to a zip file containing
 * the design file and encrypted metadata file.
 * 
 * @param revisions - Current revisions (with modifications applied)
 * @param computeRevisionsResponse - Original metadata response
 * @param designFile - Current design file
 * @param designFileContent - Content of the design file
 */
export async function exportMetadataAndDesign(
  revisions: Revision[],
  computeRevisionsResponse: ComputeRevisionsResponse,
  designFile: File,
  designFileContent: string
): Promise<void> {
  try {
    // Get encryption key
    const encryptionKey = getEncryptionKey();
    if (!encryptionKey) {
      toast.error(TOAST_MESSAGES.ENCRYPTION_KEY_MISSING);
      return;
    }

    const providerTool = new LatticeSynthesisProviderTool(encryptionKey);

    // Reconstruct changelog from revisions (in reverse order, as they're stored)
    // Revisions are in descending order (highest first), but changelog should be ascending
    const sortedRevisions = [...revisions].sort((a, b) => a.revision - b.revision);
    const changelog: BioDesignOperation[] = sortedRevisions.map(rev => ({
      operationCode: rev.operationCode,
      operationDetails: rev.operationDetails,
      change: rev.change,
      timestamp: rev.timestamp,
      tool: rev.tool,
      comments: rev.comments || [],
      status: rev.status || '',
    }));

    // Calculate checksum of current design
    let designChecksum: string;
    if (designFileContent.trim().startsWith('HEADER')) {
      designChecksum = await calculateChecksum(designFileContent);
    } else if (designFileContent.trim().startsWith('>')) {
      const sequence = extractSequenceFromFASTA(designFileContent);
      designChecksum = await calculateChecksum(sequence);
    } else {
      const sequence = await extractSequenceFromGenBank(designFileContent);
      designChecksum = await calculateChecksum(sequence);
    }

    // Reconstruct metadata object
    const metadata: BioDesignMetadata = {
      id: computeRevisionsResponse.id,
      parentMetadataId: computeRevisionsResponse.parentMetadataId || null,
      designName: computeRevisionsResponse.designName || null,
      designChecksum: designChecksum,
      author: computeRevisionsResponse.author,
      description: computeRevisionsResponse.description,
      lastUpdated: new Date().toISOString(),
      changelog: changelog,
    };

    // Convert metadata to JSON string
    const metadataJson = JSON.stringify(metadata, null, 4);

    // Encrypt the metadata
    const encryptedMetadata = await providerTool.encryptMetadata(metadataJson);

    // Create zip file
    const zip = new JSZip();
    
    // Add design file
    zip.file(designFile.name, designFileContent);
    
    // Add encrypted metadata file (use .txt extension)
    const metadataFileName = designFile.name.replace(/\.(gb|gbk|fasta|fa|faa|fna)$/i, '') + '.txt';
    zip.file(metadataFileName, encryptedMetadata);

    // Generate zip file
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    // Create download link
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${designFile.name.replace(/\.(gb|gbk|fasta|fa|faa|fna)$/i, '')}_export.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Files exported successfully!');
  } catch (error: any) {
    console.error('Error exporting files:', error);
    toast.error(error.message || 'Failed to export files.');
  }
}

