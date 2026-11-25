// 実践の手順の、コードの 1 行ずつの意味。ハンドブックの部品 (CommandLines) を呼ぶのはここだけにする。
// コマンドの名前のリンクは bash の行だけに付ける (PowerShell や YAML の行では、同じつづりでも別のものなので)
import type { HandsOnStep } from '../content/types';
import CommandLines from './CommandLines';

export default function HandsOnLines({ language, lines }: { language: NonNullable<HandsOnStep['code']>['language']; lines: NonNullable<HandsOnStep['lines']> }) {
  if (language === 'bash') return <CommandLines lines={lines} />;
  return (
    <div className="hb-fields hb-lines">
      <p className="hb-fields__title">{language === 'powershell' ? 'コマンドの意味' : '1 行ずつの意味'}</p>
      <dl>
        {lines.map((l, i) => (
          <div key={i}>
            <dt>
              <code>{l.code}</code>
            </dt>
            <dd>{l.text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
