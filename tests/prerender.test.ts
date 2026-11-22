import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
// @ts-expect-error 書き出しの手順は JS (scripts/prerender.mjs)
import { renderPage, sitemap } from '../scripts/prerender.mjs';

const template = readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

describe('ページの書き出し', () => {
  it('題名・説明・canonical・OGP・本文を、そのページのものにする', () => {
    const html = renderPage(template, { path: 'handbook/storage/', title: 'ストレージ', description: '説明', body: '<h1>ストレージ</h1>' });
    expect(html).toContain('<title>ストレージ | クラネイ</title>');
    expect(html).toContain('<link rel="canonical" href="https://maco165.github.io/kcna-dojo/handbook/storage/"');
    expect(html).toContain('<meta property="og:url" content="https://maco165.github.io/kcna-dojo/handbook/storage/"');
    expect(html).toContain('<meta name="description" content="説明"');
    expect(html).toContain('<main class="prerender">\n<h1>ストレージ</h1>');
    expect(html).not.toContain('noindex');
  });
  it('< " & と $1 $& $$ を、そのままの文字として書く (置き換えの記号として読まない)', () => {
    const html = renderPage(template, { path: 'x/', title: 'a<b>"c"&', description: 'price $1 and $& and $$', body: "<pre>awk '{print $1}'; echo $$; ps -p $&</pre>" });
    expect(html).toContain('<title>a&lt;b&gt;&quot;c&quot;&amp; | クラネイ');
    expect(html).toContain('content="price $1 and $&amp; and $$"');
    expect(html).toContain("<pre>awk '{print $1}'; echo $$; ps -p $&</pre>");
  });
  it('canonical を別のページに向けられ、noindex を付けられる', () => {
    const html = renderPage(template, { path: 'glossary/etcd/', canonical: 'glossary/', title: 't', description: 'd', body: '', noindex: true });
    expect(html).toContain('href="https://maco165.github.io/kcna-dojo/glossary/"');
    expect(html).toContain('<meta name="robots" content="noindex" />');
  });
  it('型 (index.html) の形が変わって置き換える場所が無ければ止める (黙って全ページの canonical がトップのまま公開しない)', () => {
    const broken = template.replace('<link rel="canonical"', '<link data-x rel="canonical"');
    expect(() => renderPage(broken, { path: 'x/', title: 't', description: 'd', body: '' })).toThrow(/canonical/);
  });
  it('sitemap は noindex と載せないページを除き、lastmod を付けない', () => {
    const map = sitemap([{ path: 'handbook/' }, { path: 'progress/', noindex: true }, { path: 'glossary/etcd/', inSitemap: false }]);
    expect(map).toContain('<loc>https://maco165.github.io/kcna-dojo/</loc>');
    expect(map).toContain('<loc>https://maco165.github.io/kcna-dojo/handbook/</loc>');
    expect(map).not.toMatch(/progress|glossary\/etcd|lastmod/);
  });
});
