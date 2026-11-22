export const REPO_URL = 'https://github.com/maco165/kcna-dojo';
export const NEW_ISSUE_URL = `${REPO_URL}/issues/new`;

/** 公開しているサイトの origin。報告に入れるページの URL は、開いている環境 (手元の preview など) によらずこれで作る */
export const SITE_ORIGIN = 'https://maco165.github.io';

/**
 * 問題の誤りを知らせる GitHub の新しい Issue の URL (「このサイトについて」の Issue を書くと同じ先に、題と本文を入れる)。
 * 入れるのは問題の id・レッスン・ページの URL・問題文だけ。答え・記録・端末の情報など、利用者のことは入れない
 */
export function reportIssueUrl(q: { id: string; prompt: string }, lesson: string | undefined, pathname: string): string {
  const prompt = q.prompt.length > 200 ? `${q.prompt.slice(0, 199)}…` : q.prompt;
  const body = [
    `- 問題の id: ${q.id}`,
    `- レッスン: ${lesson ?? '模擬試験用の問題 (レッスンなし)'}`,
    `- ページ: ${SITE_ORIGIN}${pathname}`,
    `- 問題文: ${prompt}`,
    '',
    '## どこが誤りか',
    '',
    '',
    '## 正しいと考える内容と根拠 (公式の文書の URL など)',
    '',
  ].join('\n');
  return `${NEW_ISSUE_URL}?${new URLSearchParams({ title: `問題の誤り: ${q.id}`, body }).toString()}`;
}
