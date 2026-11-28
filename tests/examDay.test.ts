import path from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error 書き出しの手順は JS (scripts/prerender.mjs)
import { buildPages } from '../scripts/prerender.mjs';
import { EXAM_DAY, EXAM_DAY_CHECKED_AT } from '../src/content/guide';
import { isValidDay } from '../src/lib/progress';

describe('申し込みから結果までの案内', () => {
  it('7 つの段 (申し込み・本人確認・機材と部屋・当日・結果・再受験・更新) があり、どの項目にも LF の公式の出典がある', () => {
    expect(EXAM_DAY.map((g) => g.id)).toEqual(['register', 'identity', 'room', 'day', 'result', 'retake', 'renew']);
    for (const g of EXAM_DAY) {
      expect(g.items.length, g.id).toBeGreaterThan(0);
      for (const x of g.items) {
        expect(x.sources.length, x.text).toBeGreaterThan(0);
        for (const s of x.sources) expect(new URL(s.url).host, x.text).toMatch(/^(docs|training)\.linuxfoundation\.org$/);
      }
    }
    expect(isValidDay(EXAM_DAY_CHECKED_AT)).toBe(true);
  });
  it('合格の目安は、KCNA と名指しでない共通の記述だと添える', () => {
    const pass = EXAM_DAY.flatMap((g) => g.items).filter((x) => x.text.includes('75%'));
    expect(pass).toHaveLength(1);
    expect(pass[0].text).toMatch(/共通の記述/);
  });
  it('書き出した説明のページにも、全部の項目と出典を書く', async () => {
    const pages = await buildPages((m: string) => import(/* @vite-ignore */ path.join(process.cwd(), m)));
    const body = pages.find((p: { path: string }) => p.path === 'guide/').body as string;
    expect(body).toContain('<h2 id="exam-day">申し込みから結果まで</h2>');
    for (const x of EXAM_DAY.flatMap((g) => g.items)) {
      expect(body).toContain(x.text.replace(/&/g, '&amp;'));
      for (const s of x.sources) expect(body).toContain(`href="${s.url}"`);
    }
  }, 60_000);
});
