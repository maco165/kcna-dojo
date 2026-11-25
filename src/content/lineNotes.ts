// ハンドブックのコマンドの行 → 意味。同じ行は何度出ても 1 か所にだけ書く (src/content/lineNotes/*.json)。
// 意味を付け終えたトピックは LINE_NOTE_TOPICS に入れ、全部の行に意味があることを tests/shellLinks.test.ts が見る
import { commandRows } from '../lib/shellLinks';
import type { HandbookStep } from './handbook';

const FILES = import.meta.glob<Record<string, string>>('./lineNotes/*.json', { eager: true, import: 'default' });
export const LINE_NOTES: ReadonlyMap<string, string> = new Map(Object.keys(FILES).sort().flatMap((k) => Object.entries(FILES[k])));

export const LINE_NOTE_TOPICS = new Set(['setup-k3s', 'core-concepts', 'administration', 'scheduling', 'containerization', 'networking', 'security', 'troubleshooting', 'storage', 'application-delivery', 'debugging', 'observability', 'cloud-native-principles', 'cloud-native-community', 'k3s-vs-kubernetes', 'kubernetes-history', 'kubectl-internals', 'linux-history', 'linux-internals', 'container-internals', 'authn-authz-basics', 'cicd-pipeline', 'infrastructure-as-code', 'cloud-aws-column', 'load-balancers']);

export type LineNote = { code: string; text: string };
/** 手順のコマンドの行と意味 (意味を付け終えていないトピックと、コマンドの無い手順は空) */
export function lineNotes(topicId: string, step: HandbookStep): LineNote[] {
  if (!LINE_NOTE_TOPICS.has(topicId) || step.code?.language !== 'bash') return [];
  return [...new Set(commandRows(step.code.text))].map((code) => ({ code, text: LINE_NOTES.get(code) ?? '' }));
}

/** トピックの手順ごとの意味 (画面の順)。前の手順に全部出てきた行だけの手順は repeated (畳んで出す) */
export function topicLineNotes(topicId: string, steps: HandbookStep[]): { notes: LineNote[]; repeated: boolean }[] {
  const seen = new Set<string>();
  return steps.map((s) => {
    const notes = lineNotes(topicId, s);
    const repeated = notes.length > 0 && notes.every((n) => seen.has(n.code));
    for (const n of notes) seen.add(n.code);
    return { notes, repeated };
  });
}
