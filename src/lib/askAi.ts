// 問題を Claude や ChatGPT に聞くためのリンク。入力欄に問題文を入れた状態で開く (?q= に渡す)。
// サイトからは何も送らない。開いた先で送るかどうかは使う人が決める。
import type { LabLesson, Question } from '../content/types';

/** 長すぎる URL は開けないことがあるので、文はこの長さで切る */
export const MAX_PROMPT_LENGTH = 1500;

const letter = (i: number) => String.fromCharCode(65 + i);

export type AnswerState = { picked: string; correct: boolean };

/** 問題を、AI にそのまま貼れる文にする。答えたあとなら自分の答えと正解も添える */
export function questionText(q: Question, answered?: AnswerState): string {
  const lines: string[] = ['KCNA-JP (Kubernetes and Cloud Native Associate) の勉強をしています。次の問題について日本語で教えてください。', ''];
  lines.push(`問題: ${q.prompt}`);

  if (q.type === 'fill') {
    lines.push('', '```' + q.language, q.code.replace('{{blank}}', '____'), '```');
    if (q.candidates?.length) lines.push(`候補: ${q.candidates.join(' / ')}`);
  } else {
    if (q.code) lines.push('', '```', q.code.text, '```');
    lines.push('', ...q.choices.map((c, i) => `${letter(i)}. ${c.text}`));
  }

  lines.push('');
  if (answered) {
    const right =
      q.type === 'fill' ? q.answers[0] : `${letter(q.choices.findIndex((c) => c.id === q.answer))}`;
    const mine =
      q.type === 'fill' ? answered.picked : `${letter(q.choices.findIndex((c) => c.id === answered.picked))}`;
    lines.push(
      `私の答えは ${mine} で${answered.correct ? '正解' : '不正解'}でした (正解は ${right})。`,
      'なぜその答えになるのか、ほかの選択肢との違いも含めて説明してください。',
    );
  } else {
    lines.push('すぐに答えを言わず、考え方のヒントから教えてください。');
  }

  return clip(lines.join('\n'));
}

const clip = (text: string) => (text.length > MAX_PROMPT_LENGTH ? `${text.slice(0, MAX_PROMPT_LENGTH - 1)}…` : text);

/**
 * 実習の 1 手順を、AI にそのまま貼れる文にする。
 * 初めての人がつまずくのは「このコマンドは何をしているのか」と「出たエラーの読み方」なので、その 2 つを頼む。
 * エラーはサイトからは取れないので、開いた先で続けて貼ってもらう
 */
export function labStepText(lab: Pick<LabLesson, 'title' | 'steps'>, index: number): string {
  const step = lab.steps[index];
  const lines: string[] = ['KCNA-JP (Kubernetes and Cloud Native Associate) の勉強で、k3s のクラスタを使った実習をしています。次の手順について日本語で教えてください。', ''];
  lines.push(`実習: ${lab.title}`, `手順 ${index + 1}: ${step.text}`);
  if (step.command) lines.push('', '```bash', step.command, '```');
  if (step.expect) lines.push('', `うまくいくと: ${step.expect}`);
  lines.push(
    '',
    step.command ? 'このコマンドが何をしているかを、Kubernetes が初めての人に向けて、オプションごとに説明してください。' : 'この手順で何をすればよいかを、Kubernetes が初めての人に向けて説明してください。',
    'うまくいかないときは、出たエラーをこのあとに貼ります。そのときは原因と、最初に確かめることを教えてください。',
  );
  return clip(lines.join('\n'));
}

export function aiLinks(text: string): { claude: string; chatgpt: string } {
  const q = encodeURIComponent(text);
  return {
    claude: `https://claude.ai/new?q=${q}`,
    chatgpt: `https://chatgpt.com/?q=${q}`,
  };
}
