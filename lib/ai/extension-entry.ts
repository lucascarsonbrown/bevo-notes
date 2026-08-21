/**
 * Bundle entry for the Chrome extension.
 *
 * MV3 forbids remote code, so WebLLM and this pipeline are bundled into a local
 * ESM file (scripts/build-extension.mjs). The extension reuses the exact modules
 * the web app uses rather than carrying a parallel implementation that would drift.
 */

export { detectCapability, explainCapability } from './capability';
export { generateNotes, hashTranscript } from './notes';
export { parseVTT, cuesToText } from './chunk';
export { renderNotes } from './render';
export type { Capability } from './capability';
export type { NoteProgress, GenerateNotesResult } from './notes';
export type { NotesDocument } from './types';
