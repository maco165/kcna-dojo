// 答えたあと、解説の下に出す「読み直す」。ハンドブックのトピックと用語集の語へのリンク。
// ハンドブックと用語集のデータはこの部品と一緒に、答えたあとに読む (問題の部品が lazy で読み、「次へ」の下に出すので、後から出ても次へはずれない)
import glossary from '../content/glossary.json';
import { HANDBOOK_TOPICS } from '../content/handbook';
import type { Question } from '../content/types';
import type { GlossaryTerm } from '../lib/glossary';
import { termsInQuestion, topicsForQuestion } from '../lib/readMore';
import { glossaryTermHref, handbookHref } from '../lib/route';
import { termNames } from '../lib/termLinks';

const TERMS = (glossary as { terms: GlossaryTerm[] }).terms;
const NAMES = termNames(TERMS);

/** domain: 問題の分野 (同じ分野の範囲内のトピックを先に出す) */
export default function ReadMore({ question, domain }: { question: Question; domain?: string }) {
  const termIds = termsInQuestion(question, NAMES);
  const topicIds = topicsForQuestion(question, termIds, TERMS, HANDBOOK_TOPICS, domain);
  if (termIds.length === 0 && topicIds.length === 0) return null;
  return (
    <nav className="read-more" aria-label="読み直す">
      <p className="read-more__title">読み直す</p>
      {topicIds.length > 0 && (
        <div className="read-more__row">
          <span className="read-more__label">ハンドブック</span>
          <ul className="gloss-chips">
            {topicIds.map((id) => (
              <li key={id}>
                <a className="gloss-chip" href={handbookHref(id)}>
                  {HANDBOOK_TOPICS.find((t) => t.id === id)?.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {termIds.length > 0 && (
        <div className="read-more__row">
          <span className="read-more__label">用語集</span>
          <ul className="gloss-chips">
            {termIds.map((id) => (
              <li key={id}>
                <a className="gloss-chip" href={glossaryTermHref(id)}>
                  {TERMS.find((t) => t.id === id)?.term}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}
