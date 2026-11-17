import type { LessonStatus } from '../lib/lessonStatus';

/** レッスンの行の頭の印。完了は緑のチェック、次は青の二重丸、未着手は灰の丸、実習は端末の印 */
export default function StatusIcon({ status, isLab }: { status: LessonStatus; isLab?: boolean }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (status === 'done') {
    return (
      <svg {...common} stroke="var(--color-icon-success)" role="img" aria-label="完了">
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 5-6" />
      </svg>
    );
  }
  if (status === 'next') {
    return (
      <svg {...common} stroke="var(--color-icon-accent)" role="img" aria-label="次">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="3" fill="var(--color-icon-accent)" />
      </svg>
    );
  }
  if (isLab) {
    return (
      <svg {...common} stroke="var(--color-icon-disabled)" role="img" aria-label="未着手">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="m7 9 3 3-3 3M13 15h4" />
      </svg>
    );
  }
  return (
    <svg {...common} stroke="var(--color-icon-disabled)" role="img" aria-label="未着手">
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
