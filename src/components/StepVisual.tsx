// 手順の絵: コマンドを打つ人 (kubectl など) → 操作 → 場所 (名前空間など) の中の対象。
// 中身はコマンドから自動で読む (lib/commandVisual.ts)。文字なので読み上げにもそのまま載る
import { commandActions, describeAction, type Action } from '../lib/commandVisual';

/** 1 つの手順で並べる行の数の上限 (多いときは「ほか n 件」) */
const MAX_ROWS = 4;

const OP_MARK: Record<Action['op'], string> = {
  create: '＋',
  apply: '＋',
  read: '',
  logs: '',
  wait: '',
  enter: '',
  change: '',
  delete: '×',
};

/** 見る・読む・待つは結果が手元に戻ってくるので、矢印を逆に描く */
const COMES_BACK = new Set<Action['op']>(['read', 'logs', 'wait']);

function Row({ a }: { a: Action }) {
  const back = COMES_BACK.has(a.op);
  return (
    <li className="sv__row" aria-label={describeAction(a)}>
      <span className="sv__tool" aria-hidden="true">
        {a.tool}
      </span>
      <span className={`sv__arrow${back ? ' sv__arrow--back' : ''}`} aria-hidden="true">
        {back ? '←' : '→'}
      </span>
      <span className={`sv__verb sv__verb--${a.op}`} aria-hidden="true">
        {OP_MARK[a.op] && `${OP_MARK[a.op]} `}
        {a.verb}
      </span>
      <span className={`sv__where${a.where === '手元' || a.where === 'ノード' ? ' sv__where--local' : ''}`} aria-hidden="true">
        <span className="sv__where-label">{a.where === 'クラスタ' || a.where === '手元' || a.where === 'ノード' || a.where === 'すべての名前空間' || a.where === '今の名前空間' ? a.where : `名前空間 ${a.where}`}</span>
        <span className={`sv__obj sv__obj--${a.op}`}>
          <span className="sv__kind">{a.kind}</span>
          {a.name && <span className="sv__name">{a.name}</span>}
        </span>
      </span>
    </li>
  );
}

export default function StepVisual({ code, language }: { code: string; language: 'bash' | 'yaml' }) {
  const actions = commandActions(code, language);
  if (actions.length === 0) return null;
  const shown = actions.slice(0, MAX_ROWS);
  return (
    <ul className="sv" aria-label="このコマンドで起きること">
      {shown.map((a, i) => (
        <Row key={i} a={a} />
      ))}
      {actions.length > MAX_ROWS && <li className="sv__more">ほか {actions.length - MAX_ROWS} 件</li>}
    </ul>
  );
}
