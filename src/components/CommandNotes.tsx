// 答えたあと、解説の下に出す「出てきたコマンド」。何をするか・書き方・この問題で使っているオプションと、公式リファレンスへのリンク。
// 説明のデータ (commands.json) はこの部品と一緒に、答えたあとに読む (Feedback が lazy で読む)
import { Link } from '@astryxdesign/core/Link';
import commands from '../content/commands.json';
import type { Question } from '../content/types';
import { commandUses, type CommandData } from '../lib/commandRefs';

const DATA = commands as CommandData;

export default function CommandNotes({ question }: { question: Question }) {
  const uses = commandUses(question, DATA);
  if (uses.length === 0) return null;
  return (
    <details className="cmd-notes" open>
      <summary className="cmd-notes__summary">出てきたコマンド ({uses.map((u) => u.entry.command).join('・')})</summary>
      <ul className="cmd-notes__list">
        {uses.map(({ entry, flags }) => (
          <li key={entry.id} className="cmd-note">
            <p className="cmd-note__head">
              <code className="cmd-note__name">{entry.command}</code>
              <span>{entry.summary}</span>
            </p>
            {entry.detail && <p className="cmd-note__detail">{entry.detail}</p>}
            <p className="cmd-note__row">
              <span className="cmd-note__label">書き方</span>
              <code>{entry.usage}</code>
            </p>
            {flags.length > 0 && (
              <div className="cmd-note__row">
                <span className="cmd-note__label">この問題のオプション</span>
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
            )}
            <p className="cmd-note__source">
              <Link href={entry.source} isExternalLink newTabLabel="(新しいタブで開きます)">
                公式リファレンス ({new URL(entry.source).hostname})
              </Link>
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
}
