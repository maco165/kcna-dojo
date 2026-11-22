// 画面の外のコードを、軽い <pre> で先に出し、画面に近づいたら Astryx の CodeBlock (色分け・コピーのボタン) に替える。
// CodeBlock は 1 つずつの描画が重く、ハンドブックのように数十あるページでは最初の描画を長く止める
// (Lighthouse のスマホでハンドブックの Total Blocking Time の大半を占めていた)。
// 先に出す <pre> は CodeBlock と同じ枠・字の大きさ・行の高さにして、替わるときに位置がずれないようにする (styles.css の .code-lite)。
// 文字はどちらでも同じなので、ページ内の検索・読み上げ・書き出した HTML の中身は変わらない
import { useEffect, useRef, useState } from 'react';
import { CodeBlock, type CodeBlockProps } from '@astryxdesign/core/CodeBlock';

/** 画面のどれだけ手前で CodeBlock に替えるか (スクロールで追いつかれないよう、画面 1 枚分ほど先) */
const AHEAD = '800px 0px';

type Props = { code: string; language?: CodeBlockProps['language']; title?: string; hasCopyButton?: boolean };

export default function LazyCodeBlock({ code, language, title, hasCopyButton = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (near || !ref.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          setNear(true);
        }
      },
      // PC は本文の欄 (.astryx-layout-content) がスクロールする。rootMargin は途中のスクロールの枠の切り取りを広げないので、
      // その枠を root にする (スマホは文書全体がスクロールするので、画面が root)
      { root: ref.current.closest('.astryx-layout-content'), rootMargin: AHEAD },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [near]);
  if (near) return <CodeBlock code={code} language={language} title={title} width="100%" size="sm" hasCopyButton={hasCopyButton} />;
  return (
    <div ref={ref} className="code-lite" data-lazy-code="">
      <div className="code-lite__head">{title ?? (typeof language === "string" ? language : null)}</div>
      <pre className="code-lite__body">
        <code>{code}</code>
      </pre>
    </div>
  );
}
