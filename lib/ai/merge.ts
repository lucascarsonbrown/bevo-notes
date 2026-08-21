import type { ChunkResult, NoteSection, Definition, Example, Formula } from './types';

/**
 * Deterministic merge of per-chunk results.
 *
 * There is no model call here, and there cannot be: five chunks of output run to
 * several thousand tokens, which is the same 4096-token wall the chunking exists
 * to avoid. Feeding the generated notes back through the model to "combine" them
 * would hit the original problem one layer up.
 *
 * Dedupe here is also what lets chunks be generated independently — it absorbs
 * the drift (a later chunk redefining an earlier term) that would otherwise need
 * shared prompt context threaded through every pass.
 */

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function dedupeByKey<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

export function mergeChunks(results: ChunkResult[]): NoteSection[] {
  const ordered: NoteSection[] = [];

  for (const result of results) {
    for (const section of result.sections ?? []) {
      if (!section?.heading?.trim()) continue;

      const key = normalize(section.heading);
      const existing = ordered.find((s) => normalize(s.heading) === key);

      if (existing) {
        // Same topic surfaced in a later chunk — fold its body in rather than
        // emitting a second section with an identical heading.
        existing.summary = [existing.summary, section.summary]
          .filter(Boolean)
          .join(' ')
          .trim();
        existing.definitions.push(...(section.definitions ?? []));
        existing.formulas.push(...(section.formulas ?? []));
        existing.examples.push(...(section.examples ?? []));
        existing.key_points.push(...(section.key_points ?? []));
      } else {
        ordered.push({
          heading: section.heading.trim(),
          summary: (section.summary ?? '').trim(),
          definitions: [...(section.definitions ?? [])],
          formulas: [...(section.formulas ?? [])],
          examples: [...(section.examples ?? [])],
          key_points: [...(section.key_points ?? [])],
        });
      }
    }
  }

  // Global dedupe: a term defined in chunk 2 must not be redefined in chunk 5.
  const seenTerms = new Set<string>();
  const seenPoints = new Set<string>();

  for (const section of ordered) {
    section.definitions = section.definitions.filter((d: Definition) => {
      const k = normalize(d?.term ?? '');
      if (!k || seenTerms.has(k)) return false;
      seenTerms.add(k);
      return true;
    });

    section.key_points = section.key_points.filter((p) => {
      const k = normalize(p ?? '');
      if (!k || seenPoints.has(k)) return false;
      seenPoints.add(k);
      return true;
    });

    section.formulas = dedupeByKey(section.formulas, (f: Formula) =>
      normalize(f?.latex ?? '')
    );
    section.examples = dedupeByKey(section.examples, (e: Example) =>
      normalize(e?.problem ?? '')
    );
  }

  // A section can end up empty once its content was absorbed elsewhere.
  return ordered.filter(
    (s) =>
      s.summary ||
      s.definitions.length ||
      s.formulas.length ||
      s.examples.length ||
      s.key_points.length
  );
}

/** Fallback title when the model's title pass fails or is unavailable. */
export function fallbackTitle(sections: NoteSection[]): string {
  return sections[0]?.heading?.trim() || 'Untitled Lecture';
}
