// 本文の中の用語を用語集へのリンクにする部品と、吹き出しに出す意味 (ハンドブックと実践の章で共通)。用語集のデータを読むので、開いたときに読む画面だけが取り込む
import { COMMAND_BRIEFS } from '../content/commandBriefs';
import glossary from '../content/glossary.json';
import type { GlossaryTerm } from '../lib/glossary';
import { glossaryTermHref } from '../lib/route';
import { termNames, type TermPiece } from '../lib/termLinks';

const TERMS = (glossary as { terms: GlossaryTerm[] }).terms;
export const TERM_NAMES = termNames(TERMS);
/** 語の id → 短い意味 (吹き出しに出す) */
export const MEANINGS = new Map([...TERMS.map((t) => [t.id, t.description] as const), ...COMMAND_BRIEFS.map((c) => [`cmd:${c.id}`, c.summary] as const)]);

/** 本文。用語集にある語 (ページの中で最初の 1 回) を強調し、用語集のその語へのリンクにする */
export function Prose({ pieces }: { pieces: TermPiece[] }) {
  return (
    <>
      {pieces.map((p, i) =>
        typeof p === 'string' ? (
          p
        ) : (
          <a key={i} className="hb-term" data-term={p.id} href={glossaryTermHref(p.id)}>
            {p.text}
          </a>
        ),
      )}
    </>
  );
}
