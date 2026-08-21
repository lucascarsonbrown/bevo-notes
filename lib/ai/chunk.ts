import type { Cue } from './types';

/**
 * VTT parsing and transcript chunking.
 *
 * The extension used to flatten captions to a single string, discarding every
 * timestamp. Keeping the timings lets us split on the largest pauses instead of
 * at fixed character offsets: professors pause at topic transitions, so silence
 * is a free topic-boundary signal. Fixed-width cuts land mid-derivation and
 * produce two halves that each make no sense on their own.
 */

/** "00:01:23.456" or "01:23.456" -> seconds */
function parseTimestamp(stamp: string): number {
  const parts = stamp.trim().split(':');
  if (parts.length < 2) return 0;
  const seconds = parseFloat(parts[parts.length - 1].replace(',', '.')) || 0;
  const minutes = parseInt(parts[parts.length - 2], 10) || 0;
  const hours = parts.length > 2 ? parseInt(parts[parts.length - 3], 10) || 0 : 0;
  return hours * 3600 + minutes * 60 + seconds;
}

export function parseVTT(vttText: string): Cue[] {
  const cues: Cue[] = [];
  const blocks = vttText.replace(/\r\n/g, '\n').split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim());
    const timingIndex = lines.findIndex((l) => l.includes('-->'));
    if (timingIndex === -1) continue;

    const [rawStart, rawEnd] = lines[timingIndex].split('-->');
    if (!rawStart || !rawEnd) continue;

    const text = lines
      .slice(timingIndex + 1)
      .join(' ')
      // Strip VTT inline tags such as <v Speaker> and <00:00:01.000>
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!text) continue;

    cues.push({
      start: parseTimestamp(rawStart),
      end: parseTimestamp(rawEnd.trim().split(/\s+/)[0]),
      text,
    });
  }

  return dedupeCues(cues);
}

/**
 * Rolling captions repeat the previous line as new words arrive, so raw VTT is
 * heavily redundant. Drop any cue whose text is contained in its predecessor.
 */
function dedupeCues(cues: Cue[]): Cue[] {
  const out: Cue[] = [];
  for (const cue of cues) {
    const prev = out[out.length - 1];
    if (prev && (prev.text === cue.text || prev.text.endsWith(cue.text))) continue;
    if (prev && cue.text.startsWith(prev.text)) {
      out[out.length - 1] = { ...prev, end: cue.end, text: cue.text };
      continue;
    }
    out.push(cue);
  }
  return out;
}

export function cuesToText(cues: Cue[]): string {
  return cues
    .map((c) => c.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface TranscriptChunk {
  text: string;
  startSeconds: number;
  endSeconds: number;
}

/**
 * Split cues into chunks of at most `maxChars`, preferring to break at the
 * longest silence within the trailing part of each chunk.
 */
export function chunkCues(cues: Cue[], maxChars: number): TranscriptChunk[] {
  if (!cues.length) return [];

  const chunks: TranscriptChunk[] = [];
  let current: Cue[] = [];
  let currentChars = 0;

  const flush = () => {
    if (!current.length) return;
    chunks.push({
      text: cuesToText(current),
      startSeconds: current[0].start,
      endSeconds: current[current.length - 1].end,
    });
    current = [];
    currentChars = 0;
  };

  for (const cue of cues) {
    const addedChars = cue.text.length + 1;

    if (currentChars + addedChars > maxChars && current.length) {
      const breakAt = bestBreakIndex(current);
      const carried = current.slice(breakAt);
      current = current.slice(0, breakAt);
      flush();
      current = carried;
      currentChars = carried.reduce((n, c) => n + c.text.length + 1, 0);
    }

    current.push(cue);
    currentChars += addedChars;
  }

  flush();
  return chunks;
}

/**
 * Index of the cue that begins the largest pause in the last third of the
 * buffer. Restricting to the tail keeps chunks near the target size instead of
 * breaking early at the first big gap.
 */
function bestBreakIndex(cues: Cue[]): number {
  const searchStart = Math.max(1, Math.floor(cues.length * (2 / 3)));

  let bestIndex = cues.length;
  let bestGap = -1;

  for (let i = searchStart; i < cues.length; i++) {
    const gap = cues[i].start - cues[i - 1].end;
    if (gap > bestGap) {
      bestGap = gap;
      bestIndex = i;
    }
  }

  // No meaningful silence found — keep the whole buffer rather than cut arbitrarily.
  return bestGap >= 0.75 ? bestIndex : cues.length;
}

/** Fallback for transcripts that arrive as plain text with no timing data. */
export function chunkPlainText(text: string, maxChars: number): TranscriptChunk[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const chunks: TranscriptChunk[] = [];
  let cursor = 0;

  while (cursor < clean.length) {
    let end = Math.min(cursor + maxChars, clean.length);
    if (end < clean.length) {
      // Prefer a sentence boundary, then any word boundary.
      const window = clean.slice(cursor, end);
      const sentence = window.lastIndexOf('. ');
      const space = window.lastIndexOf(' ');
      const offset = sentence > maxChars * 0.5 ? sentence + 1 : space > 0 ? space : window.length;
      end = cursor + offset;
    }
    chunks.push({ text: clean.slice(cursor, end).trim(), startSeconds: 0, endSeconds: 0 });
    cursor = end;
  }

  return chunks.filter((c) => c.text.length > 0);
}
