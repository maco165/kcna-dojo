import { settingsHref, weekHref } from '../lib/route';

type Tab = { key: string; label: string; href?: string; icon: React.ReactNode };

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const TABS: Tab[] = [
  { key: 'learn', label: '学習', href: weekHref(1), icon: <path d="M4 6h16M4 12h16M4 18h10" /> },
  { key: 'review', label: '復習', icon: (<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>) },
  { key: 'stats', label: '進捗', icon: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /> },
  { key: 'config', label: '設定', href: settingsHref, icon: (<><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>) },
];

/** スマホの下のタブ。まだ機能が無いものは「準備中」として押せない */
export default function BottomTabs({ current }: { current: string }) {
  return (
    <nav aria-label="メイン" className="tabs">
      {TABS.map((t) => {
        const isCurrent = t.key === current;
        const icon = (
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
            {t.icon}
          </svg>
        );
        if (!t.href) {
          return (
            <span key={t.key} className="tabs__item tabs__item--disabled" aria-disabled="true" title="準備中">
              {icon}
              <span>{t.label}</span>
              <span className="tabs__soon">準備中</span>
            </span>
          );
        }
        return (
          <a key={t.key} href={t.href} className={`tabs__item${isCurrent ? ' tabs__item--current' : ''}`} aria-current={isCurrent ? 'page' : undefined}>
            {icon}
            <span>{t.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
