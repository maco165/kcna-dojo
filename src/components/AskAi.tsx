import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@astryxdesign/core/Button';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { ChatBubbleLeftRightIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import type { Question } from '../content/types';
import { aiLinks, questionText, type AnswerState } from '../lib/askAi';
import { copyText } from '../lib/copyText';

/**
 * 文を入力済みにした Claude / ChatGPT を新しいタブで開く (サイトからは何も送らない)。
 * ほかの AI (Gemini など) に貼るときのために、同じ文をコピーするボタンも置く
 */
/**
 * コピーできなかったときに文を見せる窓。チェックボックスの説明の中など、文を中に置くと読み上げの説明が長くなる所で使う
 * (body の直下に出すので、置いた場所の説明に入らない)
 */
function FallbackDialog({ text, label, onClose }: { text: string; label: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal?.();
  }, []);
  return createPortal(
    <dialog ref={ref} className="ask-ai__dialog" aria-label={label} onClose={onClose}>
      <p className="ask-ai__status">コピーできませんでした。下の文を選んでコピーしてください</p>
      <textarea className="ask-ai__text" readOnly value={text} aria-label={label} rows={8} autoFocus onFocus={(e) => e.currentTarget.select()} />
      <Button size="sm" variant="secondary" label="閉じる" onClick={() => ref.current?.close()} />
    </dialog>,
    document.body,
  );
}

/** inDialog: コピーできなかったときの文を、置いた場所ではなく窓で見せる (実習の手順のチェックボックスの説明の中など) */
export function AskAiLinks({ text, lead, inDialog }: { text: string; lead: string; inDialog?: boolean }) {
  const links = aiLinks(text);
  const icon = <ChatBubbleLeftRightIcon width={16} height={16} />;
  // 写した結果は、写した文と一緒に持つ。文が変わったら (用語集で語を切り替えたなど) 出さない
  const [result, setResult] = useState<{ text: string; ok: boolean; at: number } | null>(null);
  const shown = result && result.text === text ? result : null;
  const copy = async () => {
    // 同じ結果が続いても読み上げられるよう、いったん空にしてから入れる
    setResult(null);
    const ok = await copyText(text);
    setResult({ text, ok, at: Date.now() });
  };
  // 「コピーしました」は 3 秒で消す (失敗のときの文は残す)
  useEffect(() => {
    if (!result?.ok) return;
    const t = window.setTimeout(() => setResult((r) => (r === result ? null : r)), 3000);
    return () => window.clearTimeout(t);
  }, [result]);
  return (
    <VStack gap={2}>
      {/* PC は 1 行。スマホは見出しの下に Claude・ChatGPT・プロンプトをコピーを縦に 1 つずつ並べ、左端をそろえる (src/styles.css の .ask-ai) */}
      <div className="ask-ai">
        <span className="ask-ai__lead">
          <Text type="supporting">{lead}</Text>
        </span>
        <span className="ask-ai__group">
          <Button size="sm" variant="ghost" icon={icon} label="Claude" href={links.claude} target="_blank" rel="noopener noreferrer" />
          <Button size="sm" variant="ghost" icon={icon} label="ChatGPT" href={links.chatgpt} target="_blank" rel="noopener noreferrer" />
        </span>
        <span className="ask-ai__group">
          <Button
            size="sm"
            variant="ghost"
            icon={<ClipboardDocumentIcon width={16} height={16} />}
            label="プロンプトをコピー"
            tooltip="AI に貼る文 (プロンプト) をコピーします。ほかの AI (Gemini など) に貼れます"
            onClick={() => void copy()}
          />
          {/* 読み上げにもコピーの結果を伝える */}
          <span className="ask-ai__status" role="status">
            {shown ? (shown.ok ? 'コピーしました' : inDialog ? 'コピーできませんでした' : 'コピーできませんでした。下の文を選んでコピーしてください') : ''}
          </span>
        </span>
      </div>
      {shown && !shown.ok && !inDialog && (
        <textarea className="ask-ai__text" readOnly value={text} aria-label={`${lead}の文`} rows={6} onFocus={(e) => e.currentTarget.select()} />
      )}
      {shown && !shown.ok && inDialog && <FallbackDialog text={text} label={`${lead}の文`} onClose={() => setResult(null)} />}
    </VStack>
  );
}

/** 問題文を入力済みにした Claude / ChatGPT を開く。同じ文をコピーもできる */
export default function AskAi({ question, answered }: { question: Question; answered?: AnswerState }) {
  return <AskAiLinks text={questionText(question, answered)} lead={answered ? 'もっと詳しく聞く' : 'AI にヒントを聞く'} />;
}
