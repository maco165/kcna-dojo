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
};
export type DiagramGroup = { x: number; y: number; w: number; h: number; label: string };
export type DiagramEdge = { from: string; to: string; label?: string; dashed?: boolean };
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

export default function Diagram({ spec, id }: { spec: DiagramSpec; id: string }) {
  const byId = new Map(spec.nodes.map((n) => [n.id, n]));
  const marker = `arrow-${id}`;
  const edges = spec.edges.map((e) => {
    const a = byId.get(e.from)!;
    const b = byId.get(e.to)!;
    const ca = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
    const cb = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    return { ...e, p: edgePoint(a, cb, 2), q: edgePoint(b, ca, 6) };
  });
  return (
    <figure className="dg">
      <div className="dg__scroll">
        <svg viewBox={`0 0 ${spec.width} ${spec.height}`} role="img" aria-label={spec.caption} className="dg__svg" style={{ minWidth: Math.min(spec.width, 560) }}>
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
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="8" className={`dg__node${n.tone ? ` dg__node--${n.tone}` : ''}`} />
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
                <text key={i} x={(e.p.x + e.q.x) / 2} y={(e.p.y + e.q.y) / 2 - 6} textAnchor="middle" className="dg__edge-label">
                  {e.label}
                </text>
              ),
          )}
        </svg>
      </div>
      <figcaption className="dg__caption">{spec.caption}</figcaption>
    </figure>
  );
}
