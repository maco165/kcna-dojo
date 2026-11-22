// 見えるパンくず (トップ / 一覧や週 / このページ)。書き出す HTML のパンくずと BreadcrumbList (scripts/prerender.mjs の crumbsOf) と同じ階層にする。
// href の無い項目 (ハンドブックの段・コマンドの道具) は文字だけ出す
import { BASE } from '../lib/route';
import { SITE_NAME } from '../lib/site';

export type Crumb = { name: string; href?: string };

export default function Crumbs({ items }: { items: Crumb[] }) {
  const all: Crumb[] = [{ name: SITE_NAME, href: BASE }, ...items];
  const last = all.length - 1;
  return (
    <nav aria-label="パンくず" className="hb-crumbs">
      <ol>
        {all.map((c, i) => (
          <li key={`${i}-${c.name}`} aria-current={i === last ? 'page' : undefined}>
            {c.href && i < last ? <a href={c.href}>{c.name}</a> : c.name}
          </li>
        ))}
      </ol>
    </nav>
  );
}
