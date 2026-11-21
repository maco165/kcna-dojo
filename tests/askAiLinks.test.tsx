import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AskAiLinks } from '../src/components/AskAi';

// React に act の中で描いていると伝える
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('AI に聞くの「文をコピー」', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    document.body.innerHTML = '';
  });
  it('リンクと同じ文を写し、文が変わったら (別の語を開いた) コピーしましたを出さない', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root = createRoot(el);
    await act(async () => root.render(<AskAiLinks text="etcd とは?" lead="AI に聞く" />));
    const button = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('プロンプトをコピー'))!;
    await act(async () => button.click());
    expect(writeText).toHaveBeenCalledWith('etcd とは?');
    const claude = el.querySelector('a[href^="https://claude.ai/"]')!.getAttribute('href')!;
    expect(new URL(claude).searchParams.get('q')).toBe('etcd とは?');
    expect(el.querySelector('.ask-ai__status')!.textContent).toBe('コピーしました');
    await act(async () => root.render(<AskAiLinks text="Pod とは?" lead="AI に聞く" />));
    expect(el.querySelector('.ask-ai__status')!.textContent).toBe('');
    await act(async () => root.unmount());
  });
});
