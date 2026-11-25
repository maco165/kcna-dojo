// 実践の手順の、コードの 1 行ずつの意味。同じ行が 1 つの手順に 2 回出てよいので、ハンドブックの CommandLines (行を key にし、重なりを除いて受ける) は使わず、番号を key にする。
// コマンドの名前のリンクは bash の行だけに付ける (PowerShell や YAML の行では、同じつづりでも別のものなので)
import { COMMAND_BRIEFS } from '../content/commandBriefs';
import type { HandsOnStep } from '../content/types';
import { commandsHref } from '../lib/route';
import { linkShell } from '../lib/shellLinks';

export default function HandsOnLines({ language, lines }: { language: NonNullable<HandsOnStep['code']>['language']; lines: NonNullable<HandsOnStep['lines']> }) {
  return (
    <div className="hb-fields hb-lines">
      <p className="hb-fields__title">{language === 'bash' || language === 'powershell' ? 'コマンドの意味' : '1 行ずつの意味'}</p>
      <dl>
        {lines.map((l, i) => (
          <div key={i}>
            <dt>
              <code>
                {(language === 'bash' ? linkShell(l.code, COMMAND_BRIEFS).pieces : [l.code]).map((p, j) =>
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
