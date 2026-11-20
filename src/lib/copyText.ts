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
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
