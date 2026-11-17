// kcna-dojo の Astryx テーマの元。承認済みのデザイン案 (https://claude.ai/artifact/TbAxSiWzdcuoxPPD155A6T) は
// Astryx の core の既定のトークン (色・角丸・高さ) で描かれているので、ほかのテーマを受け継がずに core の既定をそのまま使う。
// 字体だけ、案と同じくシステムの字体 (日本語は Hiragino / Noto) にする。字体のファイルは読み込まない。
// 変えたら `npm run astryx -- theme build src/themes/kcna/kcnaTheme.ts` で組み立て直し、出力も一緒にコミットする。
import { defineTheme } from '@astryxdesign/core/theme';

const systemSans = {
  family: '-apple-system',
  fallbacks: 'BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", "Noto Sans CJK JP", Helvetica, Arial, sans-serif',
};

export const kcnaTheme = defineTheme({
  name: 'kcna',
  typography: {
    body: systemSans,
    heading: systemSans,
  },
});
