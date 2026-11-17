import { describe, expect, it } from 'vitest';
import type { ChoiceQuestion, FillQuestion } from '../src/content/types';
import { MAX_PROMPT_LENGTH, aiLinks, questionText } from '../src/lib/askAi';

const fill: FillQuestion = {
  id: 'f1',
  type: 'fill',
  prompt: '空欄に入るサブコマンドは?',
  language: 'bash',
  code: 'kubectl {{blank}} pods -n kube-system',
  answers: ['get'],
  candidates: ['get', 'describe'],
  explanation: 'x',
  source: 'https://kubernetes.io/',
};

const choice: ChoiceQuestion = {
  id: 'c1',
  type: 'choice',
  prompt: 'Pod の説明は?',
  choices: [
    { id: 'a', text: 'ノード' },
    { id: 'b', text: 'いちばん小さな単位' },
  ],
  answer: 'b',
  explanation: 'x',
  source: 'https://kubernetes.io/',
};

describe('questionText', () => {
  it('穴埋めは空欄を ____ にし、候補を添える', () => {
    const t = questionText(fill);
    expect(t).toContain('問題: 空欄に入るサブコマンドは?');
    expect(t).toContain('kubectl ____ pods -n kube-system');
    expect(t).not.toContain('{{blank}}');
    expect(t).toContain('候補: get / describe');
    expect(t).toContain('ヒントから');
  });

  it('答える前は正解を入れない', () => {
    expect(questionText(fill)).not.toContain('正解は');
    expect(questionText(choice)).not.toContain('正解は');
  });

  it('4 択は記号つきの選択肢を並べ、答えたあとは自分の答えと正解を添える', () => {
    const t = questionText(choice, { picked: 'a', correct: false });
    expect(t).toContain('A. ノード');
    expect(t).toContain('B. いちばん小さな単位');
    expect(t).toContain('私の答えは A で不正解でした (正解は B)');
  });

  it('長すぎる文は切る', () => {
    const long = { ...choice, prompt: 'あ'.repeat(5000) };
    expect(questionText(long).length).toBe(MAX_PROMPT_LENGTH);
  });
});

describe('aiLinks', () => {
  it('?q= に文を入れた Claude と ChatGPT の URL を作る', () => {
    const text = 'kubectl ____ pods & a=b #x';
    const links = aiLinks(text);
    expect(links.claude.startsWith('https://claude.ai/new?q=')).toBe(true);
    expect(links.chatgpt.startsWith('https://chatgpt.com/?q=')).toBe(true);
    expect(new URL(links.claude).searchParams.get('q')).toBe(text);
    expect(new URL(links.chatgpt).searchParams.get('q')).toBe(text);
  });
});
