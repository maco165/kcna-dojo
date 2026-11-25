import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import './themes/kcna/kcna.css';
import './styles.css';
import App from './App';
import { legacyHashToPath, parseRoute } from './lib/route';
import { isLazy, loadScreen, reloadOnce } from './lib/screens';

// 最初に開いた画面の部品を先に読んでから描く (書き出した HTML から、白い画面を挟まずに切り替えるため)。
// 読めなければページごと読み直し、それでも読めなければ書き出した HTML をそのまま残す (白い画面にしない)
const first = parseRoute(legacyHashToPath(window.location.hash) ?? window.location.pathname);
const ready = isLazy(first.name) ? loadScreen(first).then(() => true, () => (reloadOnce(), false)) : Promise.resolve(true);
void ready.then((ok) => {
  if (!ok) return;
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
