// 模擬試験の結果で、合格の目安に届かなかった分野ごとに、読み直すハンドブックのトピックを出す。
// ハンドブックのデータは結果を出すときに読む (ExamScreen が lazy で読む)
import { HANDBOOK } from '../content/handbook';
import type { Domain } from '../content/types';
import { handbookHref } from '../lib/route';

export default function WeakDomains({ domains }: { domains: Domain[] }) {
  const rows = domains.map((d) => ({ d, topics: HANDBOOK.find((h) => h.domain === d)?.topics ?? [] })).filter((r) => r.topics.length > 0);
  if (rows.length === 0) return null;
  return (
    <nav className="read-more" aria-label="弱い分野を読み直す">
      <p className="read-more__title">合格の目安に届かなかった分野を読み直す</p>
      {rows.map(({ d, topics }) => (
        <div key={d} className="read-more__row">
          <span className="read-more__label">{d}</span>
          <ul className="gloss-chips">
            {topics.map((t) => (
              <li key={t.id}>
                <a className="gloss-chip" href={handbookHref(t.id)}>
                  {t.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
