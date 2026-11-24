// 設定ファイルのサンプルから、設定項目 (キー) の道を取り出す。「項目の意味」の表に抜けや余りが無いかを見るために使う。
// YAML は a.b[].c、HCL は resource.docker_image.nginx.name、Dockerfile は命令 (COPY) とフラグ (COPY --from) の形。
// このサイトのサンプルの書き方 (字下げした YAML・1 行に 1 項目の HCL) だけを読む簡単なもの。読めない書き方は unreadable() が返し、検査が落とす

function yamlKeys(text: string): string[] {
  const out: string[] = [];
  let stack: { at: number; path: string }[] = [];
  for (const line of text.split('\n')) {
    if (/^---\s*$/.test(line)) stack = [];
    if (/^\s*(#|$|---)/.test(line)) continue;
    const dashes = line.match(/^(\s*)((?:- +)*)/)!;
    let at = dashes[1].length;
    for (const d of dashes[2].match(/- +/g) ?? []) {
      // 一覧の印は、親の項目と同じ字下げでも親の中に入る
      while (stack.length && stack[stack.length - 1].at > at) stack.pop();
      stack.push({ at: at + 0.5, path: `${stack[stack.length - 1]?.path ?? ''}[]` });
      at += d.length;
    }
    const key = line.slice(at).match(/^(?:"([^"]+)"|'([^']+)'|([\w./-]+)):(?:\s|$)/);
    if (!key) continue;
    while (stack.length && stack[stack.length - 1].at >= at) stack.pop();
    const parent = stack[stack.length - 1]?.path;
    const path = `${parent ? `${parent}.` : ''}${key[1] ?? key[2] ?? key[3]}`;
    out.push(path);
    stack.push({ at, path });
  }
  return out;
}

function hclKeys(text: string): string[] {
  const out: string[] = [];
  const stack: string[] = [];
  for (const line of text.split('\n')) {
    if (/^\s*(#|$)/.test(line)) continue;
    if (/^\s*\}/.test(line)) {
      stack.pop();
      continue;
    }
    const m = line.match(/^\s*(\w+)((?:\s+"[^"]+")*)\s*(=)?\s*(\{\s*\}?)?/);
    if (!m || !(m[3] || m[4])) continue;
    const name = [m[1], ...[...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1])].join('.');
    out.push([...stack, name].join('.'));
    if (m[4] && !m[4].includes('}')) stack.push(name);
  }
  return out;
}

function dockerfileKeys(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z]+)\s(.*)$/);
    if (!m) continue;
    out.push(m[1], ...[...m[2].matchAll(/(--[a-z-]+)(?:=\S+)?\s+/gy)].map((x) => `${m[1]} ${x[1]}`));
  }
  return out;
}

export function codeKeys(language: string, text: string): string[] {
  const keys = language === 'yaml' ? yamlKeys(text) : language === 'hcl' ? hclKeys(text) : language === 'dockerfile' ? dockerfileKeys(text) : [];
  return [...new Set(keys)];
}

/** 項目を取り出せない書き方の行 (黙って飛ばすと、意味の抜けに気づけないため) */
export function unreadable(language: string, text: string): string[] {
  return text.split('\n').filter((line) => {
    if (/^\s*(#|$)/.test(line)) return false;
    // YAML: 中身のある { } のマップ ({{ }} のテンプレートは除く)・複数行の文字列・key: の形でも一覧でもない行
    if (language === 'yaml') return /(:|-)\s+\{(?!\{)\s*[^}\s]/.test(line) || /:\s+[|>][+-]?\d*\s*$/.test(line) || /^\s*(- +)*\?\s/.test(line) || !/^(---\s*$|\s*- |\s*(?:"[^"]+"|'[^']+'|[\w./-]+):(\s|$))/.test(line);
    // HCL: 閉じ括弧・ブロックの始まり・name = 値 のどれでもない行、1 行に閉じる中身のある { }、複数行の一覧
    if (language === 'hcl') return !/^\s*(\}\s*$|\w+(\s+"[^"]+")*\s*(=\s*)?\{\s*(\}\s*)?$|\w+\s*=\s*[^\s{[]|\w+\s*=\s*\[.*\]\s*$)/.test(line);
    if (language === 'dockerfile') return !/^[A-Z]+\s/.test(line) || /\\\s*$|<</.test(line);
    return false;
  });
}
