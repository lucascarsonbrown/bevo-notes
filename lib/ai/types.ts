/** Shared shapes for browser-side note generation. */

export interface Definition {
  term: string;
  meaning: string;
}

export interface Formula {
  /** LaTeX source. The model never emits markup — render.ts turns this into MathML. */
  latex: string;
  explanation: string;
}

export interface Example {
  problem: string;
  steps: string[];
}

export interface NoteSection {
  heading: string;
  summary: string;
  definitions: Definition[];
  formulas: Formula[];
  examples: Example[];
  key_points: string[];
}

/** What a single generation pass returns. */
export interface ChunkResult {
  sections: NoteSection[];
}

/** What the deterministic merge produces from all passes. */
export interface NotesDocument {
  title: string;
  sections: NoteSection[];
}

/** A timestamped caption cue, as parsed from a VTT file. */
export interface Cue {
  /** Seconds from the start of the lecture. */
  start: number;
  end: number;
  text: string;
}
