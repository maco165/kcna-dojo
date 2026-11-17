import { exportFileName, type Progress } from './progress';

/** 進捗を JSON のファイルとして保存させる (書き出し)。ブラウザの外には送らない */
export function downloadProgress(p: Progress, now: Date): void {
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFileName(now);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
