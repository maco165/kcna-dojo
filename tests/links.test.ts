import { describe, expect, it } from 'vitest';
import { NEW_ISSUE_URL, reportIssueUrl } from '../src/lib/links';

describe('問題の誤りを報告する Issue の URL', () => {
  const q = { id: 'w1-l3-q2', prompt: 'Pod の一覧を出すコマンドの空欄に入るものは?' };
  it('新しい Issue の画面に、問題の id・レッスン・公開しているページの URL・問題文を入れる', () => {
    const u = new URL(reportIssueUrl(q, '第 1 週 kubectl の基本 (w1-l3)', '/kcna-dojo/lesson/w1-l3/'));
    expect(`${u.origin}${u.pathname}`).toBe(NEW_ISSUE_URL);
    expect(u.searchParams.get('title')).toBe('問題の誤り: w1-l3-q2');
    const body = u.searchParams.get('body')!;
    expect(body).toContain('- 問題の id: w1-l3-q2');
    expect(body).toContain('- レッスン: 第 1 週 kubectl の基本 (w1-l3)');
    // 手元の preview で開いていても、公開しているサイトの URL にする (localhost などを入れない)
    expect(body).toContain('- ページ: https://maco165.github.io/kcna-dojo/lesson/w1-l3/');
    expect(body).toContain(q.prompt);
  });
  it('レッスンの無い模擬試験用の問題は、そう書く。入れるのは上の 4 つだけ (答え・記録・端末の情報は入れない)', () => {
    const body = new URL(reportIssueUrl({ id: 'x-ad-001', prompt: '問' }, undefined, '/kcna-dojo/exam/')).searchParams.get('body')!;
    expect(body).toContain('模擬試験用の問題 (レッスンなし)');
    const filled = body.split('\n').filter((l) => l.startsWith('- '));
    expect(filled.map((l) => l.split(':')[0])).toEqual(['- 問題の id', '- レッスン', '- ページ', '- 問題文']);
  });
});
