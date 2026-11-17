import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EXAM_DATE,
  DEFAULT_GOAL_XP,
  STORAGE_KEY,
  completeReview,
  dueReviewIds,
  examDate,
  exportFileName,
  goalXp,
  isValidDay,
  parseProgressText,
  resetProgress,
  setProfile,
  upcomingReview,
  completeLesson,
  currentStreak,
  emptyProgress,
  loadProgress,
  recordAnswer,
  saveProgress,
  todayXp,
} from '../src/lib/progress';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

const at = (day: string, hour = 9) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`);
const score = { correct: 4, total: 5 };

describe('completeLesson', () => {
  it('レッスンを終えると完了と最高の正答率が残る', () => {
    let p = completeLesson(emptyProgress(), 'w1-l1', score, 12, at('2026-11-23'));
    expect(p.lessons['w1-l1']).toMatchObject({ done: true, best: 0.8 });
    p = completeLesson(p, 'w1-l1', { correct: 2, total: 5 }, 6, at('2026-11-23', 10));
    expect(p.lessons['w1-l1'].best).toBe(0.8);
    p = completeLesson(p, 'w1-l1', { correct: 5, total: 5 }, 15, at('2026-11-23', 11));
    expect(p.lessons['w1-l1'].best).toBe(1);
  });

  it('同じ日に続けても連続日数は増えない', () => {
    let p = completeLesson(emptyProgress(), 'w1-l1', score, 12, at('2026-11-23', 9));
    p = completeLesson(p, 'w1-l2', score, 12, at('2026-11-23', 21));
    expect(p.streak).toEqual({ count: 1, lastDay: '2026-11-23' });
  });

  it('翌日に解くと 1 増え、1 日空くと 1 に戻る', () => {
    let p = completeLesson(emptyProgress(), 'w1-l1', score, 12, at('2026-11-23'));
    p = completeLesson(p, 'w1-l2', score, 12, at('2026-11-24'));
    expect(p.streak.count).toBe(2);
    p = completeLesson(p, 'w1-l3', score, 12, at('2026-11-26'));
    expect(p.streak.count).toBe(1);
  });

  it('月をまたいでも翌日として数える', () => {
    let p = completeLesson(emptyProgress(), 'w1-l1', score, 12, at('2026-11-30'));
    p = completeLesson(p, 'w1-l2', score, 12, at('2026-12-01'));
    expect(p.streak.count).toBe(2);
  });

  it('XP は日付ごとに足される', () => {
    let p = completeLesson(emptyProgress(), 'w1-l1', score, 12, at('2026-11-23', 9));
    p = completeLesson(p, 'w1-l2', score, 9, at('2026-11-23', 22));
    p = completeLesson(p, 'w1-l3', score, 15, at('2026-11-24', 8));
    expect(p.xp.byDay).toEqual({ '2026-11-23': 21, '2026-11-24': 15 });
    expect(p.xp.total).toBe(36);
    expect(todayXp(p, at('2026-11-24', 23))).toBe(15);
  });
});

describe('currentStreak', () => {
  it('今日か昨日に学んでいれば続いている。2 日以上空くと 0', () => {
    const p = completeLesson(emptyProgress(), 'w1-l1', score, 12, at('2026-11-23'));
    expect(currentStreak(p, at('2026-11-23', 23))).toBe(1);
    expect(currentStreak(p, at('2026-11-24', 23))).toBe(1);
    expect(currentStreak(p, at('2026-11-25'))).toBe(0);
  });
});

describe('recordAnswer', () => {
  it('問題ごとに正解と不正解の回数を数える', () => {
    let p = recordAnswer(emptyProgress(), 'w1-l1-q1', false, at('2026-11-23'));
    p = recordAnswer(p, 'w1-l1-q1', true, at('2026-11-24'));
    expect(p.answers['w1-l1-q1']).toMatchObject({ right: 1, wrong: 1 });
  });
});

describe('loadProgress / saveProgress', () => {
  it('保存した進捗を kcna.v1 のキーで読み戻せる', () => {
    const s = memoryStorage();
    const p = completeLesson(emptyProgress(), 'w1-l1', score, 12, at('2026-11-23'));
    saveProgress(p, s);
    expect(Object.keys(s.data)).toEqual([STORAGE_KEY]);
    expect(loadProgress(s)).toEqual(p);
  });

  it('壊れた JSON が入っていても例外を出さず初期値で始まる', () => {
    expect(loadProgress(memoryStorage({ [STORAGE_KEY]: '{not json' }))).toEqual(emptyProgress());
    expect(loadProgress(memoryStorage({ [STORAGE_KEY]: '[1,2,3]' }))).toEqual(emptyProgress());
    expect(loadProgress(memoryStorage({ [STORAGE_KEY]: '{"v":2}' }))).toEqual(emptyProgress());
  });

  it('欄の一部が欠けていても残りを読む', () => {
    const s = memoryStorage({ [STORAGE_KEY]: JSON.stringify({ v: 1, xp: { total: 7 } }) });
    const p = loadProgress(s);
    expect(p.xp.total).toBe(7);
    expect(p.streak).toEqual({ count: 0, lastDay: null });
  });

  it('読み出しで例外が出る環境でも初期値で始まる', () => {
    const s = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {},
    };
    expect(loadProgress(s)).toEqual(emptyProgress());
  });
});

describe('設定と記録の書き出し・読み込み・消す', () => {
  it('目標と受験日は、設定が無ければ既定の値', () => {
    expect(goalXp(emptyProgress())).toBe(DEFAULT_GOAL_XP);
    expect(examDate(emptyProgress())).toBe(DEFAULT_EXAM_DATE);
  });

  it('setProfile は片方だけ変えても、もう片方を既定の値で埋める', () => {
    const p = setProfile(emptyProgress(), { dailyGoalXp: 50 });
    expect(p.profile).toEqual({ dailyGoalXp: 50, examDate: DEFAULT_EXAM_DATE });
    expect(goalXp(p)).toBe(50);
  });

  it('書き出した中身を読み戻すと同じ進捗になる', () => {
    let p = completeLesson(emptyProgress(), 'w1-l1', score, 12, at('2026-11-23'));
    p = setProfile(p, { dailyGoalXp: 20, examDate: '2027-04-01' });
    expect(parseProgressText(JSON.stringify(p))).toEqual(p);
  });

  it('読めないファイルや、ほかの形の JSON は null', () => {
    expect(parseProgressText('not json')).toBeNull();
    expect(parseProgressText('{"v":2}')).toBeNull();
    expect(parseProgressText('[]')).toBeNull();
  });

  it('設定の値がおかしければ既定の値に直す', () => {
    const p = parseProgressText(JSON.stringify({ v: 1, profile: { dailyGoalXp: -5, examDate: 'あした' } }));
    expect(p?.profile).toEqual({ dailyGoalXp: DEFAULT_GOAL_XP, examDate: DEFAULT_EXAM_DATE });
  });

  it('記録を消すと進捗は空になり、目標と受験日は残る', () => {
    let p = completeLesson(emptyProgress(), 'w1-l1', score, 12, at('2026-11-23'));
    p = setProfile(p, { dailyGoalXp: 10 });
    const r = resetProgress(p);
    expect(r.lessons).toEqual({});
    expect(r.xp.total).toBe(0);
    expect(r.profile?.dailyGoalXp).toBe(10);
  });

  it('書き出すファイルの名前は日付入り', () => {
    expect(exportFileName(at('2026-11-23'))).toBe('kcna-progress-2026-11-23.json');
  });
});

describe('復習の予定 (1・3・7 日後)', () => {
  const q = 'w1-l1-q1';

  it('初めてで正解した問題は、復習に入らない', () => {
    const p = recordAnswer(emptyProgress(), q, true, at('2026-11-23'));
    expect(p.answers[q].nextReview).toBeUndefined();
    expect(dueReviewIds(p, at('2026-12-31'))).toEqual([]);
  });

  it('間違えると翌日、復習で正解するたびに 3 日後・7 日後、3 回続けて正解したら終わる', () => {
    let p = recordAnswer(emptyProgress(), q, false, at('2026-11-23'));
    expect(p.answers[q]).toMatchObject({ stage: 0, nextReview: '2026-11-24' });
    expect(dueReviewIds(p, at('2026-11-23', 23))).toEqual([]);
    expect(dueReviewIds(p, at('2026-11-24'))).toEqual([q]);
    p = recordAnswer(p, q, true, at('2026-11-24'));
    expect(p.answers[q]).toMatchObject({ stage: 1, nextReview: '2026-11-27' });
    p = recordAnswer(p, q, true, at('2026-11-27'));
    expect(p.answers[q]).toMatchObject({ stage: 2, nextReview: '2026-12-04' });
    p = recordAnswer(p, q, true, at('2026-12-04'));
    expect(p.answers[q].nextReview).toBeUndefined();
    expect(dueReviewIds(p, at('2027-01-01'))).toEqual([]);
  });

  it('復習の途中で間違えたら、翌日に戻す', () => {
    let p = recordAnswer(emptyProgress(), q, false, at('2026-11-23'));
    p = recordAnswer(p, q, true, at('2026-11-24'));
    p = recordAnswer(p, q, false, at('2026-11-27'));
    expect(p.answers[q]).toMatchObject({ stage: 0, nextReview: '2026-11-28' });
  });

  it('予定を過ぎた分も今日の復習に入り、早い順に並ぶ', () => {
    let p = recordAnswer(emptyProgress(), 'a', false, at('2026-11-25'));
    p = recordAnswer(p, 'b', false, at('2026-11-23'));
    expect(dueReviewIds(p, at('2026-11-30'))).toEqual(['b', 'a']);
  });

  it('次の予定の日と件数', () => {
    let p = recordAnswer(emptyProgress(), 'a', false, at('2026-11-23'));
    p = recordAnswer(p, 'b', false, at('2026-11-23'));
    expect(upcomingReview(p, at('2026-11-23'))).toEqual({ day: '2026-11-24', count: 2 });
    expect(upcomingReview(emptyProgress(), at('2026-11-23'))).toBeNull();
  });

  it('復習を終えると XP が入り連続日数が進むが、レッスンの完了は付かない', () => {
    const p = completeReview(emptyProgress(), 6, at('2026-11-24'));
    expect(p.xp.total).toBe(6);
    expect(p.streak).toEqual({ count: 1, lastDay: '2026-11-24' });
    expect(p.lessons).toEqual({});
  });
});

describe('壊れた・悪意のある記録を読み込んでも落ちない', () => {
  it('lessons と answers の中の形の違う値は捨てる', () => {
    const p = parseProgressText(JSON.stringify({ v: 1, lessons: { 'w1-l1': null, 'w1-l2': 'x', 'w1-l3': { done: true, best: 'a' } }, answers: { q: 5 } }));
    expect(p?.lessons).toEqual({ 'w1-l3': { done: true, best: 0, at: '' } });
    expect(p?.answers).toEqual({});
  });

  it('XP の日ごとの値・合計・連続日数は、0 以上の有限の数だけ受ける', () => {
    const p = parseProgressText('{"v":1,"xp":{"total":1e400,"byDay":{"2026-11-18":"abc","2026-11-19":5,"あした":3}},"streak":{"count":-1,"lastDay":"2026-02-31"}}');
    expect(p?.xp).toEqual({ total: 0, byDay: { '2026-11-19': 5 } });
    expect(p?.streak).toEqual({ count: 0, lastDay: null });
  });

  it('実在しない受験日と、選べない目標 XP は既定の値に直す', () => {
    for (const examDate of ['2027-02-31', '9999-99-99']) {
      const p = parseProgressText(JSON.stringify({ v: 1, profile: { dailyGoalXp: 7, examDate } }));
      expect(p?.profile).toEqual({ dailyGoalXp: DEFAULT_GOAL_XP, examDate: DEFAULT_EXAM_DATE });
    }
    expect(isValidDay('2028-02-29')).toBe(true);
    expect(isValidDay('2027-02-29')).toBe(false);
  });

  it('保存できなければ false を返す', () => {
    const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
    expect(saveProgress(emptyProgress(), full)).toBe(false);
    expect(saveProgress(emptyProgress(), memoryStorage())).toBe(true);
  });
});

