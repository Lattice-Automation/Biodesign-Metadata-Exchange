export type SupportedExtension = 'gb' | 'gbk' | 'pdb' | 'fasta' | 'fa' | 'faa' | 'fna' | 'txt' | 'json';

export interface GenBankSummary {
  locus?: string;
  definition?: string;
  accession?: string;
  version?: string;
  source?: string;
  organism?: string;
}

export interface PDBSummary {
  header?: string;
  title?: string;
  compound?: string;
  source?: string;
  author?: string;
}

export interface FASTASummary {
  id?: string;
  description?: string;
  length?: number;
}

export const acceptsExtension = (ext: string): ext is SupportedExtension => {
  return ['gb', 'gbk', 'pdb', 'fasta', 'fa', 'faa', 'fna', 'txt', 'json'].includes(ext as SupportedExtension);
};

export const isGenBank = (fileName: string | null | undefined): boolean => {
  if (!fileName) return false;
  const lower = fileName.toLowerCase();
  return lower.endsWith('.gb') || lower.endsWith('.gbk');
};

export const isPDB = (fileName: string | null | undefined): boolean => {
  if (!fileName) return false;
  const lower = fileName.toLowerCase();
  return lower.endsWith('.pdb');
};

export const isFASTA = (fileName: string | null | undefined): boolean => {
  if (!fileName) return false;
  const lower = fileName.toLowerCase();
  return lower.endsWith('.fasta') || lower.endsWith('.fa') || lower.endsWith('.faa') || lower.endsWith('.fna');
};

export const isDesignFile = (fileName: string | null | undefined): boolean => {
  return isGenBank(fileName) || isPDB(fileName) || isFASTA(fileName);
};

/** Infer GenBank format from content (when filename not available, e.g. results mode) */
export const isGenBankContent = (content: string | null | undefined): boolean => {
  return !!content?.trim().startsWith('LOCUS');
};

/** Infer PDB format from content (when filename not available) */
export const isPDBContent = (content: string | null | undefined): boolean => {
  return !!(content?.includes('HEADER') || content?.includes('ATOM') || content?.includes('COMPND'));
};

/** Infer FASTA format from content (when filename not available) */
export const isFASTAContent = (content: string | null | undefined): boolean => {
  return !!content?.trim().startsWith('>');
};

/** Parse FASTA content to extract id, description, and sequence length */
export const parseFASTASummary = (content: string): FASTASummary => {
  const lines = content.trim().split(/\r?\n/);
  let id = '';
  let description = '';
  let seqLength = 0;
  for (const line of lines) {
    if (line.startsWith('>')) {
      const rest = line.slice(1).trim();
      const firstSpace = rest.indexOf(' ');
      id = firstSpace >= 0 ? rest.slice(0, firstSpace) : rest;
      description = firstSpace >= 0 ? rest.slice(firstSpace + 1).trim() : '';
    } else {
      seqLength += line.replace(/\s/g, '').length;
    }
  }
  return { id: id || undefined, description: description || undefined, length: seqLength || undefined };
};

export const parseGenBankSummary = (content: string): GenBankSummary => {
  const lines = content.split(/\r?\n/);

  const collectField = (label: string): string | undefined => {
    const regex = new RegExp(`^\\s*${label}\\s+`);
    const startIndex = lines.findIndex((line) => regex.test(line));
    if (startIndex === -1) {
      return undefined;
    }

    const fragments: string[] = [lines[startIndex].replace(regex, '').trim()];

    for (let i = startIndex + 1; i < lines.length; i += 1) {
      const nextLine = lines[i];
      if (!/^\s/.test(nextLine) || /^[A-Z-]+/.test(nextLine.trim())) {
        break;
      }
      fragments.push(nextLine.trim());
    }

    return fragments.join(' ');
  };

  return {
    locus: collectField('LOCUS'),
    definition: collectField('DEFINITION'),
    accession: collectField('ACCESSION'),
    version: collectField('VERSION'),
    source: collectField('SOURCE'),
    organism: collectField('ORGANISM'),
  };
};

/**
 * Parse basic information from a PDB file
 */
export const parsePDBSummary = (content: string): PDBSummary => {
  const lines = content.split(/\r?\n/);

  const collectField = (label: string): string | undefined => {
    const regex = new RegExp(`^${label}\\s+`);
    const line = lines.find((l) => regex.test(l));
    if (!line) {
      return undefined;
    }
    // PDB format: HEADER    CATEGORY DATE IDCODE
    // Extract everything after the label
    return line.replace(regex, '').trim();
  };

  const collectMultiLineField = (label: string): string | undefined => {
    const startIndex = lines.findIndex((line) => line.startsWith(label));
    if (startIndex === -1) {
      return undefined;
    }

    const fragments: string[] = [];
    for (let i = startIndex; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line.startsWith(label) && !line.startsWith(' ')) {
        break;
      }
      // Extract content after the label (usually starts at column 11)
      const content = line.substring(10).trim();
      if (content) {
        fragments.push(content);
      }
    }

    return fragments.length > 0 ? fragments.join(' ') : undefined;
  };

  return {
    header: collectField('HEADER'),
    title: collectMultiLineField('TITLE'),
    compound: collectMultiLineField('COMPND'),
    source: collectMultiLineField('SOURCE'),
    author: collectMultiLineField('AUTHOR'),
  };
};

