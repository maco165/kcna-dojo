import { describe, expect, it } from 'vitest';
import { dueQuestions, findQuestion, isKnownQuestion } from '../src/content';
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
});
