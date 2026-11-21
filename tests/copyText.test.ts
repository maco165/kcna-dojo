import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyText } from '../src/lib/copyText';

const setClipboard = (value: unknown) => Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
const setExec = (value: unknown) => Object.defineProperty(document, 'execCommand', { value, configurable: true });

describe('文をクリップボードに写す', () => {
  const origExec = document.execCommand;
  beforeEach(() => setClipboard(undefined));
  afterEach(() => {
    setClipboard(undefined);
    setExec(origExec);
    vi.restoreAllMocks();
  });
  it('クリップボードが使えれば、そこへ写す', async () => {
    const writeText = vi.fn(async () => {});
    setClipboard({ writeText });
    expect(await copyText('kubectl get pods')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('kubectl get pods');
  });
  it('クリップボードが断ったら、文を選んで写す方法を試し、押したボタンにフォーカスを戻す', async () => {
    setClipboard({ writeText: vi.fn(async () => Promise.reject(new Error('denied'))) });
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();
    // 写す瞬間に、写したい文の textarea が選ばれていること
    let selected = '';
    setExec(
      vi.fn(() => {
        const a = document.querySelector('textarea')!;
        selected = a.value.slice(a.selectionStart, a.selectionEnd);
        return true;
      }),
    );
    expect(await copyText('kubectl get pods')).toBe(true);
    expect(selected).toBe('kubectl get pods');
    expect(document.querySelectorAll('textarea')).toHaveLength(0);
    expect(document.activeElement).toBe(button);
    button.remove();
  });
  it('どちらもだめなら false (画面で文を見せる)。execCommand が投げても、隠した textarea を残さない', async () => {
    setExec(() => false);
    expect(await copyText('x')).toBe(false);
    setExec(() => {
      throw new Error('no');
    });
    expect(await copyText('x')).toBe(false);
    expect(document.querySelectorAll('textarea')).toHaveLength(0);
  });
});
