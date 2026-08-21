import katex from 'katex';
import type { NotesDocument, NoteSection } from './types';

/**
 * Renders merged note JSON to HTML.
 *
 * The model emits LaTeX strings into data fields and never produces markup —
 * markup is generated here, deterministically. That keeps malformed HTML
 * structurally impossible and plays to what a small model is actually good at:
 * small models have seen far more LaTeX than MathML.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderLatex(latex: string, displayMode = true): string {
  // Malformed LaTeX from a 1B model is expected, so failures must degrade
  // rather than throw. With throwOnError:false KaTeX doesn't raise — it returns
  // a red `katex-error` span holding the source, which reads badly inside a
  // page of notes. Detect that and fall back to plain inline code instead.
  let rendered: string;
  try {
    rendered = katex.renderToString(latex, {
      output: 'mathml',
      displayMode,
      throwOnError: false,
      strict: false,
    });
  } catch {
    return `<code>${escapeHtml(latex)}</code>`;
  }

  if (rendered.includes('katex-error')) {
    return `<code>${escapeHtml(latex)}</code>`;
  }
  return rendered;
}

function renderSection(section: NoteSection): string {
  const parts: string[] = [`<h2>${escapeHtml(section.heading)}</h2>`];

  if (section.summary) {
    parts.push(`<p>${escapeHtml(section.summary)}</p>`);
  }

  if (section.definitions.length) {
    parts.push('<dl class="bevo-definitions">');
    for (const d of section.definitions) {
      parts.push(
        `<dt>${escapeHtml(d.term)}</dt><dd>${escapeHtml(d.meaning)}</dd>`
      );
    }
    parts.push('</dl>');
  }

  for (const f of section.formulas) {
    parts.push(`<figure class="bevo-formula">${renderLatex(f.latex)}`);
    if (f.explanation) {
      parts.push(`<figcaption>${escapeHtml(f.explanation)}</figcaption>`);
    }
    parts.push('</figure>');
  }

  for (const e of section.examples) {
    parts.push('<div class="bevo-example">');
    parts.push(`<p><strong>Example.</strong> ${escapeHtml(e.problem)}</p>`);
    if (e.steps?.length) {
      parts.push('<ol>');
      for (const step of e.steps) parts.push(`<li>${escapeHtml(step)}</li>`);
      parts.push('</ol>');
    }
    parts.push('</div>');
  }

  if (section.key_points.length) {
    parts.push('<ul class="bevo-key-points">');
    for (const p of section.key_points) parts.push(`<li>${escapeHtml(p)}</li>`);
    parts.push('</ul>');
  }

  return parts.join('\n');
}

export function renderNotes(doc: NotesDocument): string {
  const body = doc.sections.map(renderSection).join('\n');
  return `<h1>${escapeHtml(doc.title)}</h1>\n${body}`;
}

/** Plain text for embedding and search, without markup noise. */
export function sectionToPlainText(section: NoteSection): string {
  const parts = [section.heading, section.summary];
  for (const d of section.definitions) parts.push(`${d.term}: ${d.meaning}`);
  for (const f of section.formulas) parts.push(`${f.latex} — ${f.explanation}`);
  for (const e of section.examples) parts.push([e.problem, ...(e.steps ?? [])].join(' '));
  parts.push(...section.key_points);
  return parts.filter(Boolean).join('\n').trim();
}
