// 学習のまとめのカード (1080×1350 の PNG)。進捗の画面で「まとめのカードを作る」を押したときにだけ読む。
// 描くのは学んだ期間・学んだ日の数・解いた問題の数・連続日数・分野ごとの到達だけで、名前・端末・受験日・問題の id や答えは描かない
import { MASTERY_LABEL, MASTERY_ORDER, pctOf, type DomainMastery } from './mastery';
import { currentStreak, dayKey, daysBetween, firstStudyDay, type Progress } from './progress';

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;
const M = 72;
const COLOR = { bg: '#F1F4F7', card: '#FFFFFF', border: '#CCD3DB', text: '#0A1317', sub: '#4E606F', accent: '#0064E0', once: '#80B2F0', wrong: '#D31130', track: '#E4E9EE' };
const FONT = "system-ui, -apple-system, 'Segoe UI', 'Hiragino Sans', 'Noto Sans JP', 'Noto Sans CJK JP', sans-serif";

export type CardData = {
  from: string;
  to: string;
  /** 期間の日数 (始めた日と今日を含む) */
  days: number;
  studiedDays: number;
  solved: number;
  streak: number;
  domains: DomainMastery[];
};

/** カードに描く数。まだ何も学んでいなければ null */
export function cardData(p: Progress, now: Date, domains: DomainMastery[]): CardData | null {
  // 始めた日: 記録のいちばん古い日と、答えた日 (solved) のいちばん古い日の早いほう
  const from = [firstStudyDay(p), ...Object.keys(p.solved ?? {})].filter((x): x is string => !!x).sort()[0];
  if (!from) return null;
  const to = dayKey(now);
  return {
    from,
    to,
    days: Math.max(1, daysBetween(from, to) + 1),
    studiedDays: Object.keys(p.xp.byDay).length,
    solved: Object.values(p.answers).reduce((s, a) => s + a.right + a.wrong, 0),
    streak: currentStreak(p, now),
    domains,
  };
}

const slash = (d: string) => d.replace(/-/g, '/');

/** 画像の説明 (img の alt と、共有するファイルの説明) */
export function cardAlt(d: CardData): string {
  return `クラネイの学習のまとめ。${slash(d.from)}〜${slash(d.to)} (${d.days} 日) に ${d.studiedDays} 日学び、${d.solved} 問を解いた。連続 ${d.streak} 日。${d.domains.map((x) => `${x.domain}: 2 回続けて正解 ${x.counts.twice} / ${x.total} 問`).join('、')}`;
}

export const cardFileName = (d: CardData) => `kcna-summary-${d.to}.png`;

/** 描くのに使う canvas の機能だけ (テストでは記録するだけの偽物を渡す) */
export type Ctx = Pick<CanvasRenderingContext2D, 'fillRect' | 'fillText' | 'measureText' | 'beginPath' | 'fill' | 'stroke' | 'moveTo' | 'lineTo' | 'arcTo' | 'closePath'> & {
  font: string;
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  textBaseline: CanvasTextBaseline;
};

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx: Ctx, s: string, x: number, y: number, size: number, weight: 400 | 700, color: string) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

/** カードを描く (1080×1350) */
export function drawCard(ctx: Ctx, d: CardData): void {
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  roundRect(ctx, 36, 36, CARD_WIDTH - 72, CARD_HEIGHT - 72, 32);
  ctx.fillStyle = COLOR.card;
  ctx.fill();
  ctx.strokeStyle = COLOR.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  // 上: ロゴとサイト名、題
  roundRect(ctx, M, M + 8, 64, 64, 14);
  ctx.fillStyle = COLOR.accent;
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(M + 17, M + 28);
  ctx.lineTo(M + 29, M + 40);
  ctx.lineTo(M + 17, M + 52);
  ctx.moveTo(M + 34, M + 52);
  ctx.lineTo(M + 47, M + 52);
  ctx.stroke();
  text(ctx, 'クラネイ', M + 84, M + 56, 36, 700, COLOR.text);
  text(ctx, '学習のまとめ', M, 260, 64, 700, COLOR.text);
  text(ctx, `${slash(d.from)} 〜 ${slash(d.to)} (${d.days} 日)`, M, 320, 32, 400, COLOR.sub);

  // 数: 学んだ日・解いた問題・連続
  const stats: [string, string][] = [
    ['学んだ日', `${d.studiedDays} 日`],
    ['解いた問題', `${d.solved} 問`],
    ['連続', `${d.streak} 日`],
  ];
  const colW = (CARD_WIDTH - M * 2) / 3;
  stats.forEach(([label, value], i) => {
    const x = M + colW * i;
    text(ctx, label, x, 420, 28, 400, COLOR.sub);
    text(ctx, value, x, 490, 56, 700, COLOR.text);
  });
  ctx.fillStyle = COLOR.border;
  ctx.fillRect(M, 540, CARD_WIDTH - M * 2, 2);

  // 分野ごとの到達
  text(ctx, '問題ごとの到達', M, 610, 36, 700, COLOR.text);
  const barW = CARD_WIDTH - M * 2;
  const colors: Record<string, string> = { twice: COLOR.accent, once: COLOR.once, wrong: COLOR.wrong, new: COLOR.track };
  d.domains.forEach((row, i) => {
    const y = 670 + i * 125;
    text(ctx, row.short, M, y, 30, 700, COLOR.text);
    const pct = `${pctOf(row.counts.twice, row.total)}%`;
    ctx.font = `700 30px ${FONT}`;
    text(ctx, pct, CARD_WIDTH - M - ctx.measureText(pct).width, y, 30, 700, COLOR.accent);
    let x = M;
    for (const m of MASTERY_ORDER) {
      const w = row.total > 0 ? (row.counts[m] / row.total) * barW : m === 'new' ? barW : 0;
      ctx.fillStyle = colors[m];
      ctx.fillRect(x, y + 20, w, 20);
      x += w;
    }
    text(ctx, MASTERY_ORDER.map((m) => `${MASTERY_LABEL[m].replace(' (直近)', '')} ${row.counts[m]}`).join(' · '), M, y + 76, 24, 400, COLOR.sub);
  });

  // 下: 凡例とサイト
  ctx.fillStyle = COLOR.border;
  ctx.fillRect(M, CARD_HEIGHT - 170, CARD_WIDTH - M * 2, 2);
  text(ctx, '% は 2 回続けて正解した問題の割合', M, CARD_HEIGHT - 120, 24, 400, COLOR.sub);
  text(ctx, 'maco165.github.io/kcna-dojo', M, CARD_HEIGHT - 80, 28, 400, COLOR.sub);
}
