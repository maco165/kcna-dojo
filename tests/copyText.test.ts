import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from '../src/lib/copyText';

const setClipboard = (value: unknown) => Object.defineProperty(navigator, 'clipboard', { value, configurable: true });

describe('文をクリップボードに写す', () => {
  afterEach(() => {
    setClipboard(undefined);
    vi.restoreAllMocks();
  });
  it('クリップボードが使えれば、そこへ写す', async () => {
    const writeText = vi.fn(async () => {});
    setClipboard({ writeText });
    expect(await copyText('kubectl get pods')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('kubectl get pods');
  });
  it('クリップボードが断ったら、選んで写す方法を試す', async () => {
    setClipboard({ writeText: vi.fn(async () => Promise.reject(new Error('denied'))) });
    const exec = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true });
    expect(await copyText('x')).toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
    expect(document.querySelectorAll('textarea')).toHaveLength(0);
  });
  it('どちらもだめなら false (画面で文を見せる)', async () => {
    setClipboard(undefined);
    Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true });
    expect(await copyText('x')).toBe(false);
  });
});
