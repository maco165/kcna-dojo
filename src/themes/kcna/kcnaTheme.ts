// kcna-dojo の Astryx テーマの元。neutral を受け継ぎ、強調の色だけを Astryx の core の既定値 (青) に戻す。
// 承認済みのデザイン案 (https://claude.ai/artifact/TbAxSiWzdcuoxPPD155A6T) が core の既定の色で描かれているため。
// 値は `npm run astryx -- docs tokens/tokens-color` の Core default (light, dark) の写し。
// 変えたら `npm run astryx -- theme build src/themes/kcna/kcnaTheme.ts` で組み立て直し、出力も一緒にコミットする。
import { defineTheme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';

export const kcnaTheme = defineTheme({
  name: 'kcna',
  extends: neutralTheme,
  tokens: {
    '--color-accent': ['#0064E0', '#0171E3'],
    '--color-accent-muted': ['#0082FB33', '#0082FB3F'],
    '--color-on-accent': ['#FFFFFF', '#FFFFFF'],
    '--color-text-accent': ['#0064E0', '#3E9EFB'],
    '--color-icon-accent': ['#0064E0', '#2694FE'],
  },
});
