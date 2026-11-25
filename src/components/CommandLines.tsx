// コードの下に出す「コマンドの意味」: 1 行ずつの説明。行の中のコマンドの名前は、用語と同じ吹き出しとコマンドのページへつなぐ
import { COMMAND_BRIEFS } from '../content/commandBriefs';
import type { HandbookLine } from '../content/handbook';
import { commandsHref } from '../lib/route';
import { linkShell } from '../lib/shellLinks';

/** isShell: 行の中のコマンドの名前をリンクにするか (PowerShell や YAML の行では、同じつづりでも別のものなのでしない) */
export default function CommandLines({ lines, isShell = true, title = 'コマンドの意味' }: { lines: HandbookLine[]; isShell?: boolean; title?: string }) {
  return (
    <div className="hb-fields hb-lines">
      <p className="hb-fields__title">{title}</p>
      <dl>
        {lines.map((l, i) => (
          <div key={i}>
            <dt>
              <code>
                {(isShell ? linkShell(l.code, COMMAND_BRIEFS).pieces : [l.code]).map((p, j) =>
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
