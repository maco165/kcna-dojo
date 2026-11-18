// 箱と矢印のデータから描く図 (ハンドブックの図)。色は Astryx の token なので、ライト・ダークに追従する
export type DiagramNode = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sub?: string;
  /** accent: 主役 / warn: 失敗・拒否 / muted: 補足 */
  tone?: 'accent' | 'warn' | 'muted';
  /** 用語集の図で、この箱が表す用語の id (その用語を見ているときに強調する) */
  term?: string;
};
export type DiagramGroup = { x: number; y: number; w: number; h: number; label: string };
export type Side = 'top' | 'bottom' | 'left' | 'right';
/** fromSide / toSide を付けると、その辺の真ん中から出入りする (付けなければ中心どうしを結ぶ線と縁の交点) */
export type DiagramEdge = { from: string; to: string; label?: string; dashed?: boolean; fromSide?: Side; toSide?: Side };
export type DiagramSpec = {
  /** 読み上げと図の下の説明に使う 1〜2 文 */
  caption: string;
  width: number;
  height: number;
  groups?: DiagramGroup[];
  nodes: DiagramNode[];
  edges: DiagramEdge[];
};

type Pt = { x: number; y: number };

function sidePoint(n: DiagramNode, side: Side, pad: number): Pt {
  if (side === 'top') return { x: n.x + n.w / 2, y: n.y - pad };
  if (side === 'bottom') return { x: n.x + n.w / 2, y: n.y + n.h + pad };
  if (side === 'left') return { x: n.x - pad, y: n.y + n.h / 2 };
  return { x: n.x + n.w + pad, y: n.y + n.h / 2 };
}

/** 矢印の両端 (テストでも使う) */
export function edgeEnds(spec: DiagramSpec, e: DiagramEdge): { p: Pt; q: Pt } {
  const a = spec.nodes.find((n) => n.id === e.from)!;
  const b = spec.nodes.find((n) => n.id === e.to)!;
  const ca = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const cb = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const p = e.fromSide ? sidePoint(a, e.fromSide, 2) : edgePoint(a, e.toSide ? sidePoint(b, e.toSide, 0) : cb, 2);
  const q = e.toSide ? sidePoint(b, e.toSide, 6) : edgePoint(b, e.fromSide ? sidePoint(a, e.fromSide, 0) : ca, 6);
  return { p, q };
}

/** 矢印の文字の置き場所。横向きの線は線の上、縦向きの線は線の右 */
export function labelPlace(p: Pt, q: Pt): { x: number; y: number; anchor: 'middle' | 'start' } {
  const mx = (p.x + q.x) / 2;
  const my = (p.y + q.y) / 2;
  return Math.abs(q.x - p.x) >= Math.abs(q.y - p.y) ? { x: mx, y: my - 6, anchor: 'middle' } : { x: mx + 8, y: my + 4, anchor: 'start' };
}

/** 箱の中心から相手の中心へ向かう線が、箱の縁と交わる点 */
function edgePoint(n: DiagramNode, toward: Pt, pad = 4): Pt {
  const cx = n.x + n.w / 2;
  const cy = n.y + n.h / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const sx = dx === 0 ? Infinity : (n.w / 2 + pad) / Math.abs(dx);
  const sy = dy === 0 ? Infinity : (n.h / 2 + pad) / Math.abs(dy);
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}

/** 箱の色。highlight の用語を表す箱は主役の色にする */
const toneOf = (n: DiagramNode, highlight?: string) => (highlight !== undefined && n.term === highlight ? 'accent' : n.tone);

export default function Diagram({ spec, id, highlight }: { spec: DiagramSpec; id: string; highlight?: string }) {
  const marker = `arrow-${id}`;
  const edges = spec.edges.map((e) => ({ ...e, ...edgeEnds(spec, e) }));
  return (
    <figure className="dg">
      <div className="dg__scroll">
        {/* 説明は figcaption が受け持つので、図そのものは読み上げない (同じ文が並ばないように) */}
        <svg viewBox={`0 0 ${spec.width} ${spec.height}`} aria-hidden="true" focusable="false" className="dg__svg">
          <defs>
            <marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" className="dg__head" />
            </marker>
          </defs>
          {spec.groups?.map((g) => (
            <g key={g.label}>
              <rect x={g.x} y={g.y} width={g.w} height={g.h} rx="12" className="dg__group" />
              <text x={g.x + 12} y={g.y + 20} className="dg__group-label">
                {g.label}
              </text>
            </g>
          ))}
          {edges.map((e, i) => (
            <line key={i} x1={e.p.x} y1={e.p.y} x2={e.q.x} y2={e.q.y} className={e.dashed ? 'dg__edge dg__edge--dashed' : 'dg__edge'} markerEnd={`url(#${marker})`} />
          ))}
          {spec.nodes.map((n) => (
            <g key={n.id}>
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="8" className={`dg__node${toneOf(n, highlight) ? ` dg__node--${toneOf(n, highlight)}` : ''}`} />
              <text x={n.x + n.w / 2} y={n.y + (n.sub ? n.h / 2 - 3 : n.h / 2 + 5)} textAnchor="middle" className="dg__label">
                {n.label}
              </text>
              {n.sub && (
                <text x={n.x + n.w / 2} y={n.y + n.h / 2 + 15} textAnchor="middle" className="dg__sub">
                  {n.sub}
                </text>
              )}
            </g>
          ))}
          {/* 矢印の文字は箱より上に描いて、箱に隠れないようにする */}
          {edges.map(
            (e, i) =>
              e.label && (
                <text key={i} {...(({ x, y }) => ({ x, y }))(labelPlace(e.p, e.q))} textAnchor={labelPlace(e.p, e.q).anchor} className="dg__edge-label">
                  {e.label}
                </text>
              ),
          )}
        </svg>
      </div>
      {/* スマホでは図を幅に収めて全体を見せ、小さくなる文字は、つながりの一覧で補う */}
      <ul className="dg__links" aria-label="図のつながり">
        {spec.edges.map((e, i) => {
          const from = spec.nodes.find((n) => n.id === e.from)!;
          const to = spec.nodes.find((n) => n.id === e.to)!;
          return (
            <li key={i}>
              <span className="dg__links-node">{from.label}</span>
              <span aria-hidden="true"> → </span>
              <span className="dg__links-node">{to.label}</span>
              {e.label && <span className="dg__links-label">{e.label}</span>}
            </li>
          );
        })}
      </ul>
      <figcaption className="dg__caption">{spec.caption}</figcaption>
    </figure>
  );
}

/**
 * 目次のカードに出す小さな絵。図の箱と矢印だけを描き、文字は省く (飾りなので読み上げない)。
 * 図を直せばサムネイルも同じように変わる
 */
export function DiagramThumb({ spec }: { spec: DiagramSpec }) {
  return (
    <svg viewBox={`0 0 ${spec.width} ${spec.height}`} className="dg-thumb" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">
      {spec.groups?.map((g) => <rect key={g.label} x={g.x} y={g.y} width={g.w} height={g.h} rx="14" className="dg-thumb__group" />)}
      {spec.edges.map((e, i) => {
        const { p, q } = edgeEnds(spec, e);
        return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} className={e.dashed ? 'dg-thumb__edge dg-thumb__edge--dashed' : 'dg-thumb__edge'} />;
      })}
      {spec.nodes.map((n) => (
        <rect key={n.id} x={n.x} y={n.y} width={n.w} height={n.h} rx="10" className={`dg-thumb__node${n.tone ? ` dg-thumb__node--${n.tone}` : ''}`} />
      ))}
    </svg>
  );
}
