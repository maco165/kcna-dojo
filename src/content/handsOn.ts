// 実践の章の軽い一覧 (?meta: 手順は id と OS だけ)。実践の一覧・進捗・題名が読む。章の全文は handsOnChapters.ts (章を開いたときだけ読む)
import type { HandsOnMeta } from './types';

const FILES = import.meta.glob<HandsOnMeta>('./hands-on/*.json', { eager: true, import: 'default', query: '?meta' });

/** 章の並び。1 章も無くても空の配列になる */
export const HANDS_ON: HandsOnMeta[] = Object.values(FILES).sort((a, b) => a.order - b.order);

export const HANDS_ON_TITLE = '実践';

/** 一覧の始めの説明 (画面と書き出す HTML で共通) */
export const HANDS_ON_LEAD = '読んだことや問題で覚えたことを、自分の端末で動かして確かめるページです。完了の数は問題演習とは別に数えます。';
export const HANDS_ON_WHO = 'Kubernetes が初めての人は、問題演習と実践の両方を進めます。問題だけ解きたい人は、問題演習だけで進められます。どちらも好きな順に開けます。';
export const CHAPTERS_LEAD = '手順ごとに、なぜするのか・コマンドの意味・出力の読み方・つまずいた時の直し方まで書いた章です。';
export const LABS_LEAD = '問題演習の週に合わせた、短い実習です。k3s のクラスタを用意してから始めます。中身を章に入れた実習は、ここには並べません。';
export const NO_CHAPTERS = '章は準備中です。';

/** 中身を章が全部覆った旧い実習と、その章の id。実践の一覧と完了の数から外す (ページ・URL・記録・XP は残す)。対応は docs/design.md */
export const COVERED_LABS: Record<string, readonly string[]> = {
  'w1-lab': ['run-containers'],
  'w2-lab': ['install-k3s', 'self-healing'],
};

/** 一覧に並べる実習 (章が覆ったものを除く) */
export const isListedLab = (lab: { id: string }) => !(lab.id in COVERED_LABS);

/** 実習を覆った章 (並びの順)。覆っていなければ空 */
export const chaptersOfLab = (labId: string): HandsOnMeta[] => HANDS_ON.filter((c) => COVERED_LABS[labId]?.includes(c.id));

/** 覆った実習のページに出す 1 行の始め (画面と書き出す HTML で共通。後ろに章へのリンクを続ける) */
export const COVERED_LEAD = 'この実習の中身は、実践の章に入りました。初めての人はこちらから:';

/** 章の番号 ("0 章") */
export const chapterNo = (c: { order: number }) => `${c.order} 章`;

/** 章のページの短い題名 (画面・書き出す HTML で共通) */
export const chapterTitle = (id: string, chapters: Pick<HandsOnMeta, 'id' | 'title' | 'short'>[] = HANDS_ON) => {
  const c = chapters.find((x) => x.id === id);
  return c ? (c.short ?? c.title) : HANDS_ON_TITLE;
};
