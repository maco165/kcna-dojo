// 文をクリップボードに写す。navigator.clipboard が使えない (http・古いブラウザ・許可が無い) ときは、
// 隠した textarea を選んで execCommand('copy') を試す。どちらもだめなら false を返す (画面で文を見せて手でコピーしてもらう)
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 下の方法を試す
  }
  // 選ぶと押したボタンからフォーカスが外れるので、あとで戻す
  const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const area = document.createElement('textarea');
  try {
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    // iOS で選ぶときに画面が拡大されないよう 16px にする
    area.style.fontSize = '16px';
    document.body.appendChild(area);
    area.select();
    // iOS Safari は select() だけでは選べないことがあるので、範囲でも選ぶ
    area.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
    prev?.focus();
  }
}
