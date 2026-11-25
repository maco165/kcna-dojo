// 後から読む部品 (React.lazy) を読めなかったときの受け止め。新しい版を出したあとの開いたままのタブなどで、
// 古いチャンクが 404 になると lazy が投げ、受け止めないと #root ごと消えて白紙になる
import { Component, Suspense, type ReactNode } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';

/** 子の描画で投げられたら fallback を出す (白紙にしない)。resetKey が変わったら (別のページへ移ったら) もう一度描く */
export class LoadBoundary extends Component<{ fallback: ReactNode; children: ReactNode; resetKey?: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(prev: { resetKey?: string }) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** 答えたあとの読み直す先など、無くても画面が使える後から読む部品。読めなければ何も出さず、画面の残りはそのまま使える */
export function LazyPart({ children }: { children: ReactNode }) {
  return (
    <LoadBoundary fallback={null}>
      <Suspense fallback={null}>{children}</Suspense>
    </LoadBoundary>
  );
}

/** 画面の全体を読めなかったときに出す知らせ。読み直すと、新しい版の HTML とチャンクを読む */
export function LoadFailed() {
  return (
    <main className="page__section load-failed" role="alert">
      <Text type="large">画面を読み込めませんでした</Text>
      <Text type="supporting">回線が切れたか、サイトが新しい版になった可能性があります。</Text>
      <Button variant="primary" label="読み直す" onClick={() => window.location.reload()} />
      <Button variant="ghost" label="トップへ" href={import.meta.env.BASE_URL} />
    </main>
  );
}
