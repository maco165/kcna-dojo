// 用語集の図。正本は src/content/glossaryFigures/*.json ({ id, terms, spec } の並び)。
// 関係の深い用語は 1 つの図を共有し、箱の term で見ている用語を強調する。用語集の画面だけが読む
import type { DiagramSpec } from '../components/Diagram';

export type GlossaryFigure = { id: string; terms: string[]; spec: DiagramSpec };

const FILES = import.meta.glob<GlossaryFigure[]>('./glossaryFigures/*.json', { eager: true, import: 'default' });

export const GLOSSARY_FIGURES: GlossaryFigure[] = Object.keys(FILES)
  .sort()
  .flatMap((k) => FILES[k]);

const BY_TERM = new Map(GLOSSARY_FIGURES.flatMap((f) => f.terms.map((t) => [t, f] as const)));

/** その用語の図 (無ければ undefined) */
export const figureOf = (termId: string) => BY_TERM.get(termId);
