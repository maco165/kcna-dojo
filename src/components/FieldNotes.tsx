// 設定ファイルのサンプルの下に出す「設定項目の意味」の表と、公式の出典
import { Link } from '@astryxdesign/core/Link';
import type { HandbookFields, HandbookTopic } from '../content/handbook';

export default function FieldNotes({ title, fields, sources }: { title?: string; fields: HandbookFields; sources: HandbookTopic['sources'] }) {
  return (
    <section className="hb-fields" aria-label={`${title ?? ''} の設定項目の意味`}>
      <p className="hb-fields__title">設定項目の意味</p>
      <dl>
        {fields.items.map((f) => (
          <div key={f.keys.join()}>
            <dt>
              {f.keys.map((k) => (
                <code key={k}>{k}</code>
              ))}
            </dt>
            <dd>{f.text}</dd>
          </div>
        ))}
      </dl>
      <p className="hb-fields__source">
        出典:{' '}
        {fields.sources.map((u) => (
          <span key={u}>
            <Link href={u} isExternalLink newTabLabel="(新しいタブで開きます)">
              {sources.find((s) => s.url === u)?.label ?? u}
            </Link>
          </span>
        ))}
      </p>
    </section>
  );
}
