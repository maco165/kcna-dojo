// 本文の用語 (a[data-term]) の短い意味の吹き出し。1 ページに 1 つだけ置き、イベントは囲む要素でまとめて受ける
// (用語ごとに部品を付けると、数十語のページで最初の描画が重くなるため)。意味は用語集の description で、新しく読むものは無い。
// カーソル・キーボードのフォーカスで出し、クリックは今までどおり用語集へ。タッチは 1 回目のタップで出し、
// 出た吹き出し (または同じ語のもう 1 回のタップ) で用語集へ移る。
// WCAG 1.4.13: Esc で消せる・カーソルを吹き出しへ移せる・カーソルやフォーカスが離れるまで消えない
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { glossaryTermHref } from '../lib/route';

const TIP_ID = 'term-tip';
const TIP_WIDTH = 320;
const GAP = 6;
/** 通り過ぎただけのカーソルでは出さない / 語から吹き出しへ移る間は消さない */
const SHOW_MS = 150;
const HIDE_MS = 200;

const termOf = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>('a[data-term]') : null);
const inTip = (t: EventTarget | null) => t instanceof Element && t.closest('.term-tip') !== null;

export default function TermTipArea({ meanings, children, ...rest }: { meanings: ReadonlyMap<string, string>; children: ReactNode; className?: string; 'aria-labelledby'?: string }) {
  const area = useRef<HTMLElement>(null);
  const tip = useRef<HTMLAnchorElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const touched = useRef(false);
  /** Esc で消した、フォーカスの残っている語 (カーソルの出入りで勝手に戻さない) */
  const dismissed = useRef<HTMLElement | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const after = (ms: number, el: HTMLElement | null) => {
    window.clearTimeout(timer.current);
    if (ms === 0) setAnchor(el);
    else timer.current = window.setTimeout(() => setAnchor(el), ms);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // 語の下に置く。下に入らなければ上。左右は本文の幅に収める
  useLayoutEffect(() => {
    const a = area.current;
    const el = tip.current;
    if (!anchor || !a || !el) return;
    const box = a.getBoundingClientRect();
    const rects = anchor.getClientRects();
    if (rects.length === 0) return;
    const first = rects[0];
    const last = rects[rects.length - 1];
    const style = getComputedStyle(a);
    const padL = parseFloat(style.paddingLeft);
    const inner = box.width - padL - parseFloat(style.paddingRight);
    el.style.width = `${Math.min(TIP_WIDTH, inner)}px`;
    const h = el.offsetHeight;
    // スマホは下のタブの帯に隠れるので、その上までを画面とみなす
    const bar = document.querySelector('nav.tabs')?.getBoundingClientRect();
    const bottom = bar && bar.height > 0 ? bar.top : window.innerHeight;
    const below = last.bottom + GAP + h <= bottom || first.top - GAP - h < 0;
    const r = below ? last : first;
    const left = Math.max(padL, Math.min(r.left - box.left, padL + inner - el.offsetWidth));
    el.style.left = `${left}px`;
    el.style.top = `${(below ? r.bottom + GAP : r.top - GAP - h) - box.top}px`;
    el.style.visibility = 'visible';
    anchor.setAttribute('aria-describedby', TIP_ID);
    return () => anchor.removeAttribute('aria-describedby');
  }, [anchor]);

  // 出ている間だけ、Esc・外を押す・幅が変わるのを見る
  useEffect(() => {
    if (!anchor) return;
    const close = () => after(0, null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      dismissed.current = termOf(document.activeElement);
      close();
    };
    const onDown = (e: PointerEvent) => {
      if (!inTip(e.target) && termOf(e.target) !== anchor) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('resize', close);
    };
  }, [anchor]);

  const id = anchor?.dataset.term;
  return (
    <article
      {...rest}
      ref={area}
      onPointerOver={(e) => {
        if (e.pointerType === 'touch') return;
        const t = termOf(e.target);
        if (t) after(anchor ? 0 : SHOW_MS, t);
        else if (inTip(e.target)) window.clearTimeout(timer.current);
      }}
      onPointerOut={(e) => {
        if (e.pointerType === 'touch' || !(termOf(e.target) || inTip(e.target))) return;
        // フォーカスのある語の意味は、カーソルが離れても出したままにする
        const focused = termOf(document.activeElement);
        after(HIDE_MS, focused && focused !== dismissed.current && focused.matches(':focus-visible') ? focused : null);
      }}
      onPointerDown={(e) => {
        touched.current = e.pointerType === 'touch';
      }}
      onFocus={(e) => {
        const t = termOf(e.target);
        // 押したときのフォーカスでは出さない (タッチは onClick で出す)
        if (t?.matches(':focus-visible')) after(0, t);
      }}
      onBlur={(e) => {
        dismissed.current = null;
        if (termOf(e.target) && !inTip(e.relatedTarget) && !touched.current) after(0, null);
      }}
      onClick={(e) => {
        const t = termOf(e.target);
        if (!t || !touched.current || e.detail === 0 || t === anchor) return;
        e.preventDefault();
        after(0, t);
      }}
    >
      {children}
      {anchor && id && (
        // 中のリンクは語と同じ行き先なので、Tab の順には入れない
        <a ref={tip} key={id} className="term-tip" href={glossaryTermHref(id)} tabIndex={-1}>
          <span id={TIP_ID} role="tooltip" className="term-tip__text">
            {meanings.get(id)}
          </span>
          <span className="term-tip__more" aria-hidden="true">
            用語集で詳しく →
          </span>
        </a>
      )}
    </article>
  );
}
