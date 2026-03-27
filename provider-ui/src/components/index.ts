/**
 * Barrel export for components
 * Allows cleaner imports like: import { Header, FileUploadZone } from '../components'
 */

export { default as Header } from './Header';
export { default as FileUploadZone } from './FileUploadZone';
export { default as DesignOverviewCard } from './DesignOverviewCard';
export { default as MetadataOverviewCard } from './MetadataOverviewCard';
export { default as VersionGraph } from './VersionGraph';
export { default as VersionDetailsPanel } from './VersionDetailsPanel';
export { default as RevisionNode } from './RevisionNode';
export type { RevisionNodeData } from './RevisionNode';
export { default as RevisionSetNode } from './RevisionSetNode';
export type { RevisionSetNodeData } from './RevisionSetNode';

