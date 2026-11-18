import { describe, expect, it } from 'vitest';
import { dueQuestions, dueReviewCount, findQuestion, isKnownQuestion } from '../src/content';
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
