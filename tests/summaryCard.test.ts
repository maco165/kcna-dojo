import { describe, expect, it } from 'vitest';
import { CARD_HEIGHT, CARD_WIDTH, cardAlt, cardData, cardFileName, drawCard, type Ctx } from '../src/lib/summaryCard';
import { masteryByDomain } from '../src/lib/mastery';
import { completeLesson, emptyProgress, recordAnswer, setProfile, type Progress } from '../src/lib/progress';

const at = (day: string) => new Date(`${day}T12:00:00`);

/** 描いた文字と塗った四角を記録するだけの canvas */
function fakeCtx() {
  const texts: string[] = [];
  const rects: number[][] = [];
  const ctx = {
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    textBaseline: 'alphabetic',
    fillRect: (...a: number[]) => void rects.push(a),
    fillText: (s: string) => void texts.push(s),
    measureText: (s: string) => ({ width: s.length * 16 }),
    beginPath() {},
    fill() {},
    stroke() {},
    moveTo() {},
    lineTo() {},
    arcTo() {},
    closePath() {},
  };
  return { ctx: ctx as unknown as Ctx, texts, rects };
}

function sample(): Progress {
  let p = setProfile(emptyProgress(), { examDate: '2027-01-15', weeklyDays: 3 });
  p = recordAnswer(p, 'w1-l1-q1', true, at('2026-11-01'));
  p = recordAnswer(p, 'w1-l1-q1', true, at('2026-11-02'));
  p = recordAnswer(p, 'w1-l1-q2', false, at('2026-11-02'));
  p = completeLesson(p, 'w1-l1', { correct: 1, total: 2 }, 3, at('2026-11-02'));
  return p;
}

describe('学習のまとめのカード', () => {
  it('まだ学んでいなければ作らない', () => {
    expect(cardData(emptyProgress(), at('2026-11-25'), masteryByDomain(emptyProgress()))).toBeNull();
  });

  it('期間・学んだ日・解いた問題・連続・分野ごとの到達を数える', () => {
    const p = sample();
    const d = cardData(p, at('2026-11-03'), masteryByDomain(p))!;
    // 答えは 3 回 (q1 を 2 回・q2 を 1 回) だが、解いた問題は 2 問 (R-008)
    expect(d).toMatchObject({ from: '2026-11-01', to: '2026-11-03', days: 3, studiedDays: 1, solved: 2, streak: 1 });
    expect(d.domains[0].counts).toMatchObject({ twice: 1, wrong: 1 });
    expect(cardFileName(d)).toBe('kcna-summary-2026-11-03.png');
  });

  it('1080×1350 に、期間・数・分野を描き、受験日・問題の id・答えは描かない', () => {
    const p = sample();
    const d = cardData(p, at('2026-11-03'), masteryByDomain(p))!;
    const { ctx, texts, rects } = fakeCtx();
    drawCard(ctx, d);
    expect(rects[0]).toEqual([0, 0, CARD_WIDTH, CARD_HEIGHT]);
    const all = texts.join('\n');
    for (const s of ['学習のまとめ', '2026/11/01 〜 2026/11/03 (3 日)', '学んだ日', '解いた問題', '連続', '1 日', '2 問', 'Fundamentals', 'Orchestration', 'App Delivery', 'Architecture', 'maco165.github.io/kcna-dojo']) expect(all).toContain(s);
    expect(all).not.toMatch(/w1-l1|2027|受験/);
    const alt = cardAlt(d);
    expect(alt).toContain('2 問を解いた');
    expect(alt).not.toMatch(/w1-l1|2027/);
  });
});
