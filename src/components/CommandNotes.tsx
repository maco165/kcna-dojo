// 答えたあと、解説の下に出す「出てきたコマンド」。何をするか・書き方・この問題で使っているオプションと、公式リファレンスへのリンク。
// 説明のデータ (commands.json) はこの部品と一緒に読む (問題を開いたときに先に読み、答えたあとに出す。src/components/Feedback.tsx)
import { Link } from '@astryxdesign/core/Link';
import commands from '../content/commands.json';
import type { Question } from '../content/types';
import { commandUses, type CommandData, type CommandFlag } from '../lib/commandRefs';

const DATA = commands as CommandData;

function Flags({ label, flags }: { label: string; flags: CommandFlag[] }) {
  return (
    <div className="cmd-note__row">
      <span className="cmd-note__label">{label}</span>
      <dl className="cmd-note__flags">
        {flags.map((f) => (
          <div key={f.flags.join(',')}>
            <dt>
              <code>{f.flags.join(', ')}</code>
            </dt>
            <dd>{f.text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** open: 最初から開いて出すか (既定は、コマンドが 1 つなら開く。多いと「次へ」が遠くなるので閉じる) */
export default function CommandNotes({ question, open }: { question: Question; open?: boolean }) {
  const uses = commandUses(question, DATA);
  if (uses.length === 0) return null;
  return (
    <details className="cmd-notes" open={open ?? uses.length === 1}>
      <summary className="cmd-notes__summary">出てきたコマンド ({uses.map((u) => u.entry.command).join('・')})</summary>
      <ul className="cmd-notes__list">
        {uses.map(({ entry, flags }) => (
          <li key={entry.id} className="cmd-note">
            <p className="cmd-note__head">
              <code className="cmd-note__name">{entry.command}</code>
              {entry.absent && <span className="cmd-note__absent">無いコマンド</span>}
              <span>{entry.summary}</span>
            </p>
            {entry.detail && <p className="cmd-note__detail">{entry.detail}</p>}
            <p className="cmd-note__row">
              <span className="cmd-note__label">書き方</span>
              <code>{entry.usage}</code>
            </p>
            {flags.some((f) => !f.absent) && <Flags label="この問題のオプション" flags={flags.filter((f) => !f.absent)} />}
            {flags.some((f) => f.absent) && <Flags label={`${entry.command} に無い指定 (誤りの選択肢に出てくるもの)`} flags={flags.filter((f) => f.absent)} />}
            <p className="cmd-note__source">
              <Link href={entry.source} isExternalLink newTabLabel="(新しいタブで開きます)">
                公式リファレンス ({new URL(entry.source).hostname})
              </Link>
              {(entry.refs ?? []).map((r) => (
                <span key={r.url}>
                  {' · '}
                  <Link href={r.url} isExternalLink newTabLabel="(新しいタブで開きます)">
                    {r.label}
                  </Link>
                </span>
              ))}
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
}
