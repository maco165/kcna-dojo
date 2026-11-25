// 章が覆った旧い実習と、その章。w2-lab は、ノード 1 台で見える範囲を章が覆った。複数ノードの見え方 (agent・置き場所の分かれ方) は実習のページに残す。
// ホームが最初に読むので、章のデータ (handsOn.ts) は読まず、章の id・番号・題だけをここに持つ
// (週の「先に読む」と同じ持ち方。実在と、番号と題が章のデータと同じことは tests/handsOn.test.tsx が見る)。対応の中身は docs/design.md
import { labsOf } from '../lib/lessonStatus';
import type { LabLesson } from './types';
import type { WeekMeta } from './curriculum';

export type ChapterRef = { id: string; order: number; title: string };

/** 実践の一覧と完了の数から外す実習 (ページ・URL・記録・XP は残す) */
export const COVERED_LABS: Record<string, readonly ChapterRef[]> = {
  'w1-lab': [{ id: 'run-containers', order: 2, title: 'コンテナを動かす' }],
  'w2-lab': [
    { id: 'install-k3s', order: 1, title: 'k3s を入れて、最初のコンテナを動かす' },
    { id: 'self-healing', order: 3, title: '壊れても戻る仕組みを見る' },
  ],
  'w4-lab': [{ id: 'scaling', order: 4, title: '増やす、減らす' }],
};

/** 初めに進める章。章は前の章で作った仮想マシンを使うので、週の画面から章へ送るときは先頭に置く */
export const FIRST_CHAPTER: ChapterRef = { id: 'vm-setup', order: 0, title: '仮想マシンを用意する' };

/** 章の番号 ("0 章") */
export const chapterNo = (c: { order: number }) => `${c.order} 章`;

/** 実習を覆った章 (並びの順)。覆っていなければ空 */
export const chaptersOfLab = (labId: string): readonly ChapterRef[] => COVERED_LABS[labId] ?? [];

/** 一覧に並べ、完了の数 (一覧・進捗) に入れる実習 (章が覆ったものを除く) */
export const listedLabs = (weeks: WeekMeta[]): { lab: LabLesson; week: number }[] => weeks.flatMap((w) => labsOf(w).filter((lab) => chaptersOfLab(lab.id).length === 0).map((lab) => ({ lab, week: w.week })));

/** 週の画面の「動かして確かめる」の行き先 (サイトの中の道)。実習が覆われていれば、その章へ直接送る */
export const handsOnLinks = (week: WeekMeta): { path: string; label: string }[] =>
  labsOf(week).flatMap((lab) => {
    const chapters = chaptersOfLab(lab.id);
    return chapters.length > 0 ? [FIRST_CHAPTER, ...chapters].map((c) => ({ path: `hands-on/${c.id}/`, label: `${chapterNo(c)} ${c.title}` })) : [{ path: `lesson/${lab.id}/`, label: lab.title }];
  });

/** 週の画面の行き先の前に置く短い文 (章へ送る週では、0 章から順に進めることを添える) */
export const handsOnLabel = (week: WeekMeta) => `動かして確かめる${labsOf(week).some((lab) => chaptersOfLab(lab.id).length > 0) ? ` (章は ${chapterNo(FIRST_CHAPTER)}から順に進めます)` : ''}`;

/** 覆った実習のページと結果に出す 1 行の始め (画面と書き出す HTML で共通。後ろに章へのリンクを続ける) */
export const COVERED_LEAD = 'この実習の中身は、実践の章に入りました。初めての人はこちらから:';

/** 章が覆っていない分の残る実習に、章へのリンクの後ろへ足す文 */
export const COVERED_REST: Record<string, string> = { 'w2-lab': '複数のノードがある人は、この実習も役に立ちます。' };

/** 覆ったが、まだ役に立つ所の残る実習 (一覧の説明から 1 行でつなぐ) */
export const restLabs = (weeks: WeekMeta[]): LabLesson[] => weeks.flatMap(labsOf).filter((lab) => lab.id in COVERED_REST);
export const REST_LEAD = '複数のノードがある人は、この実習も役に立ちます:';
