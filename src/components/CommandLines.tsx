// コードの下に出す「コマンドの意味」: 1 行ずつの説明。行の中のコマンドの名前は、用語と同じ吹き出しとコマンドのページへつなぐ。
// 同じページの前の手順に出てきた行だけなら、畳んでおく (ページが長くならないように)
import { COMMAND_BRIEFS } from '../content/commandBriefs';
import type { LineNote } from '../content/lineNotes';
import { commandsHref } from '../lib/route';
import { linkShell } from '../lib/shellLinks';

export default function CommandLines({ lines, repeated }: { lines: LineNote[]; repeated: boolean }) {
  const list = (
    <dl>
      {lines.map((l) => (
        <div key={l.code}>
          <dt>
            <code>
              {linkShell(l.code, COMMAND_BRIEFS).pieces.map((p, j) =>
                typeof p === 'string' ? (
                  p
                ) : (
                  <a key={j} className="hb-cmd" data-term={`cmd:${p.id}`} href={commandsHref(p.id)}>
                    {p.text}
                  </a>
                ),
              )}
            </code>
          </dt>
          <dd>{l.text}</dd>
        </div>
      ))}
    </dl>
  );
  if (repeated)
    return (
      <details className="hb-fields hb-lines">
        <summary>コマンドの意味 (前の手順に出てきたもの)</summary>
        {list}
      </details>
    );
  return (
    <div className="hb-fields hb-lines">
      <p className="hb-fields__title">コマンドの意味</p>
      {list}
    </div>
  );
}
