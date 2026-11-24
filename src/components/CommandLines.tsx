// コードの下に出す「コマンドの意味」: 1 行ずつの説明。行の中のコマンドの名前は、用語と同じ吹き出しとコマンドのページへつなぐ
import { COMMAND_BRIEFS } from '../content/commandBriefs';
import type { HandbookLine } from '../content/handbook';
import { commandsHref } from '../lib/route';
import { linkShell } from '../lib/shellLinks';

export default function CommandLines({ lines }: { lines: HandbookLine[] }) {
  return (
    <div className="hb-fields hb-lines">
      <p className="hb-fields__title">コマンドの意味</p>
      <dl>
        {lines.map((l, i) => (
          <div key={i}>
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
    </div>
  );
}
