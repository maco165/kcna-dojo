import { describe, expect, it } from 'vitest';
import { questionBank } from '../src/content/lessons';
import { EXAM_ONLY } from '../src/content/examBank';
import { startExam } from '../src/lib/exam';
import { EXAM_SAVE_KEY, clearExam, isExpired, loadExam, saveExam } from '../src/lib/examSave';
import { STORAGE_KEY } from '../src/lib/progress';
import examSets from '../src/content/examSets.json';

function memoryStorage(initial: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => void (data[k] = v),
    removeItem: (k: string) => void delete data[k],
  };
}

const bank = [...questionBank(), ...EXAM_ONLY];
const sets = (examSets as { sets: { id: number; questions: string[] }[] }).sets;

describe('模擬試験の途中の保存', () => {
  it('回・問題と選択肢の並び・答え・いまの問題・期限を保存し、同じ並びで戻せる', () => {
    const s = memoryStorage();
    const { items, set } = startExam(1, sets, bank);
    const answers = items.map((b, i) => (i === 0 ? (b.question.type === 'choice' ? b.question.choices[2].id : 'get') : undefined));
    saveExam({ set, items, answers, index: 7, endsAt: 1_000_000 }, s);
    const back = loadExam(bank, s)!;
    expect(back.set).toBe(1);
    expect(back.index).toBe(7);
    expect(back.endsAt).toBe(1_000_000);
    expect(back.answers).toEqual(answers);
    // 問題の順も、4 択の選択肢と穴埋めの候補の画面の並びも同じ (答えは並びの位置ではなく id で持つが、画面の A〜D を変えない)
    expect(back.items.map((b) => b.question.id)).toEqual(items.map((b) => b.question.id));
    expect(back.items.map((b) => (b.question.type === 'choice' ? b.question.choices.map((c) => c.id) : b.question.candidates))).toEqual(
      items.map((b) => (b.question.type === 'choice' ? b.question.choices.map((c) => c.id) : b.question.candidates)),
    );
    expect(back.items.map((b) => b.domain)).toEqual(items.map((b) => b.domain));
  });

  it('進捗の kcna.v1 とは別のキーに置き、進捗を書き換えない', () => {
    const s = memoryStorage({ [STORAGE_KEY]: '{"v":1}' });
    const { items } = startExam('random', sets, questionBank());
    saveExam({ items, answers: [], index: 0, endsAt: 1 }, s);
    expect(EXAM_SAVE_KEY).not.toBe(STORAGE_KEY);
    expect(s.data[STORAGE_KEY]).toBe('{"v":1}');
    expect(loadExam(bank, s)!.set).toBeUndefined();
    clearExam(s);
    expect(s.data[EXAM_SAVE_KEY]).toBeUndefined();
    expect(loadExam(bank, s)).toBeNull();
  });

  it('壊れた保存・束に無い問題・選択肢の変わった問題は戻さない (null)', () => {
    const { items, set } = startExam(2, sets, bank);
    const good = memoryStorage();
    saveExam({ set, items, answers: [], index: 0, endsAt: 1 }, good);
    const saved = JSON.parse(good.data[EXAM_SAVE_KEY]);
    for (const broken of [
      'not json',
      JSON.stringify({ ...saved, v: 2 }),
      JSON.stringify({ ...saved, index: 999 }),
      JSON.stringify({ ...saved, endsAt: 'あした' }),
      JSON.stringify({ ...saved, answers: [] }),
      JSON.stringify({ ...saved, items: [{ id: 'no-such-question' }, ...saved.items.slice(1)] }),
      JSON.stringify({ ...saved, items: saved.items.map((it: { id: string; order?: string[] }) => (it.order ? { ...it, order: [...it.order.slice(1), 'zzz'] } : it)) }),
    ]) {
      expect(loadExam(bank, memoryStorage({ [EXAM_SAVE_KEY]: broken }))).toBeNull();
    }
  });

  it('期限を過ぎたかは保存した時刻で決める (閉じている間も時間は進む)', () => {
    const { items } = startExam(1, sets, bank);
    const e = { items, answers: [], index: 0, endsAt: 5_000 };
    expect(isExpired(e, 4_999)).toBe(false);
    expect(isExpired(e, 5_000)).toBe(true);
  });
});
