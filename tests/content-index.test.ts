import { describe, expect, it } from 'vitest';
import { dueQuestions, dueReviewCount, isKnownQuestion } from '../src/content';
import { findQuestion } from '../src/content/lessons';
import { EXAM_ONLY, findExamQuestion } from '../src/content/examBank';
import { emptyProgress, recordAnswer, upcomingReview } from '../src/lib/progress';

const at = (day: string) => new Date(`${day}T09:00:00`);

describe('復習の問題を問題データから引く', () => {
  it('問題データにある id だけを今日の復習として数える (消えた id は飛ばす)', () => {
    let p = recordAnswer(emptyProgress(), 'w1-l1-q1', false, at('2026-11-23'));
    p = recordAnswer(p, 'w9-gone-q1', false, at('2026-11-23'));
    expect(findQuestion('w1-l1-q1')?.lesson.id).toBe('w1-l1');
    expect(isKnownQuestion('w9-gone-q1')).toBe(false);
    expect(dueQuestions(p, at('2026-11-24')).map((r) => r.question.id)).toEqual(['w1-l1-q1']);
    expect(upcomingReview(p, at('2026-11-23'), isKnownQuestion)).toEqual({ day: '2026-11-24', count: 1 });
  });

  it('模擬試験用の問題は、数には入り、引くのは find を渡したときだけ', () => {
    const x = EXAM_ONLY[0].question.id;
    let p = recordAnswer(emptyProgress(), 'w1-l1-q1', false, at('2026-11-23'));
    p = recordAnswer(p, x, false, at('2026-11-23'));
    const day = at('2026-11-24');
    expect(dueReviewCount(p, day)).toBe(2);
    // データから消えた x- の問題は数えない (復習の画面で引けないので)
    expect(dueReviewCount(recordAnswer(p, 'x-gone-001', false, at('2026-11-23')), day)).toBe(2);
    expect(dueQuestions(p, day).map((r) => r.question.id)).toEqual(['w1-l1-q1']);
    const both = dueQuestions(p, day, (id) => findQuestion(id) ?? findExamQuestion(id));
    expect(both.map((r) => r.question.id).sort()).toEqual(['w1-l1-q1', x].sort());
    expect(both.find((r) => r.question.id === x)?.week).toBe(0);
  });

  it('模擬試験用の問題は x- で始まり、レッスンの問題と id が重ならない', () => {
    expect(EXAM_ONLY.length).toBeGreaterThan(0);
    for (const r of EXAM_ONLY) {
      expect(r.question.id.startsWith('x-')).toBe(true);
      expect(findQuestion(r.question.id)).toBeUndefined();
    }
  });
});

describe('週の問題の軽い形 (vite.config.ts の lightLessons)', () => {
  it('curriculum.ts の WEEKS は問題を id・形・問題文だけで持ち、全文 (lessons.ts) と同じ問題を同じ順で持つ', async () => {
    const { WEEKS } = await import('../src/content/curriculum');
    const { WEEK_CONTENTS } = await import('../src/content/lessons');
    const light = WEEKS.flatMap((w) => (w.content?.lessons ?? []).flatMap((l) => (l.kind === 'quiz' ? l.questions : [])));
    const full = WEEK_CONTENTS.flatMap((w) => w.lessons.flatMap((l) => (l.kind === 'quiz' ? l.questions : [])));
    expect(light.length).toBeGreaterThan(200);
    expect(light).toEqual(full.map(({ id, type, prompt }) => ({ id, type, prompt })));
  });
});
