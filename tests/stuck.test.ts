import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { HANDS_ON } from '../src/content/handsOn';
import { HANDS_ON_CHAPTERS } from '../src/content/handsOnAll';
import { NEW_ISSUE_URL } from '../src/lib/links';
import { STUCK_FIELDS, STUCK_TEMPLATE, chapterK3s, codesOf, k3sInstallOf, stuckIssueUrl } from '../src/lib/stuck';

const chapter = { id: 'install-k3s', order: 1, title: 'k3s を入れて、最初のコンテナを動かす' };
const step = { id: 'install', text: 'あ'.repeat(300) };
const url = (os?: string) => new URL(stuckIssueUrl({ chapter, step, where: '手順 5', os, k3s: 'v1.36.6+k3s1', pathname: '/kcna-dojo/hands-on/install-k3s/' }));

describe('ここで詰まった', () => {
  it('詰まりの書式を選び、章・手順・ページ・OS・章の版の欄を埋める', () => {
    const u = url('Mac');
    expect(`${u.origin}${u.pathname}`).toBe(NEW_ISSUE_URL);
    const q = Object.fromEntries(u.searchParams);
    expect(q.template).toBe('stuck.yml');
    expect(q.title).toBe('詰まった: 1 章 手順 5 (install-k3s / install)');
    expect(q.chapter).toBe('1 章「k3s を入れて、最初のコンテナを動かす」(install-k3s)');
    expect(q.step.startsWith('手順 5 (install): あ')).toBe(true);
    expect(q.page).toBe('https://maco165.github.io/kcna-dojo/hands-on/install-k3s/#step-install');
    expect(q['chapter-os']).toBe('Mac');
    expect(q['chapter-k3s']).toBe('v1.36.6+k3s1');
    expect(url()['searchParams'].get('chapter-os')).toMatch(/選んでいない/);
  });
  it('手順の本文は頭だけ。URL は 2,000 字を超えない (GitHub の 414 の手前)。入れるのは決めた欄だけ', () => {
    const u = url('Windows');
    expect([...u.searchParams.get('step')!].length).toBeLessThanOrEqual(100);
    expect(u.href.length).toBeLessThan(2000);
    expect([...u.searchParams.keys()].sort()).toEqual(['template', 'title', ...STUCK_FIELDS].sort());
    // 印・記録・端末の情報は入れない
    expect(u.href).not.toMatch(/kcna\.v1|userAgent|Mozilla|localhost/);
  });
  it('全部の章の全部の手順で、URL は 2,000 字を超えない', () => {
    for (const c of HANDS_ON_CHAPTERS)
      for (const s of [...c.steps, ...c.cleanup])
        expect(stuckIssueUrl({ chapter: c, step: s, where: '後片付け 10', os: 'Windows', k3s: 'v1.36.6+k3s1', pathname: `/kcna-dojo/hands-on/${c.id}/` }).length, `${c.id} ${s.id}`).toBeLessThan(2000);
  });
  it('章の版の引き方: 入れる行の版 (引用符・rc も)。版を決めずに入れたら分からない。取ってくるだけ・見るだけの行は数えない', () => {
    expect(k3sInstallOf(['curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=v1.36.6+k3s1 sh -'])).toBe('v1.36.6+k3s1');
    expect(k3sInstallOf(['curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION="v1.36.6+k3s1" sh -'])).toBe('v1.36.6+k3s1');
    expect(k3sInstallOf(["curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION='v1.37.0-rc1+k3s1' sh -s - server"])).toBe('v1.37.0-rc1+k3s1');
    expect(k3sInstallOf(['curl -sfL https://get.k3s.io | sudo INSTALL_K3S_VERSION=v1.36.6+k3s1 sh -'])).toBe('v1.36.6+k3s1');
    expect(k3sInstallOf(['curl -sfL https://get.k3s.io | INSTALL_K3S_CHANNEL=v1.36 sh -'])).toBeNull();
    expect(k3sInstallOf(['curl -sfL https://get.k3s.io | sh -'])).toBeNull();
    expect(k3sInstallOf(['INSTALL_K3S_VERSION=v1.35.3+k3s1 sh get-k3s.sh'])).toBe('v1.35.3+k3s1');
    // 最後に入れた行の版
    expect(k3sInstallOf(['curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=v1.35.3+k3s1 sh -', 'x\ncurl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=v1.36.6+k3s1 sh -'])).toBe('v1.36.6+k3s1');
    expect(k3sInstallOf(['curl -sI https://get.k3s.io | head -n 1', 'curl -sfL https://get.k3s.io -o get-k3s.sh', "curl -sfL https://get.k3s.io | grep -n 'INSTALL_K3S_VERSION'", 'k3s --version'])).toBeUndefined();
  });
  it('章の版: その章までで最後に入れた章の版。どの章も入れる前は「使わない」、版の分からない入れ方なら「分からない」', () => {
    const list = [{ id: 'a', order: 0 }, { id: 'b', order: 1, k3s: 'v1.1.1+k3s1' }, { id: 'c', order: 2 }, { id: 'd', order: 3, k3s: null }, { id: 'e', order: 4 }];
    expect(['a', 'b', 'c', 'd', 'e'].map((id) => chapterK3s(id, list))).toEqual([undefined, 'v1.1.1+k3s1', 'v1.1.1+k3s1', null, null]);
    const k3s = (v: string | null | undefined) => new URL(stuckIssueUrl({ chapter, step, where: '手順 1', k3s: v, pathname: '/' })).searchParams.get('chapter-k3s');
    expect([k3s(undefined), k3s(null), k3s('v1.36.6+k3s1')]).toEqual(['この章では k3s を使わない', '章の版は分からない', 'v1.36.6+k3s1']);
    // 実際の章: 0 章は使わない、1 章から後は 1 章が入れた版
    const v = k3sInstallOf(codesOf(HANDS_ON_CHAPTERS.find((c) => c.order === 1)!));
    expect(v).toMatch(/^v1\.\d+\.\d+\+k3s\d+$/);
    expect(HANDS_ON.map((c) => chapterK3s(c.id, HANDS_ON))).toEqual(HANDS_ON.map((c) => (c.order === 0 ? undefined : v)));
  });
  it('書式 (stuck.yml) の欄の id と、URL の query の名前が合う。出力の欄は shell で、消してから貼ると書いてある', () => {
    const yml = readFileSync(path.join(process.cwd(), '.github/ISSUE_TEMPLATE', STUCK_TEMPLATE), 'utf8');
    const ids = [...yml.matchAll(/^\s+id: ([\w-]+)$/gm)].map((m) => m[1]);
    for (const f of STUCK_FIELDS) expect(ids).toContain(f);
    expect(ids).toEqual(expect.arrayContaining(['did', 'output', 'expected', 'env', 'tried']));
    expect(new Set(ids).size).toBe(ids.length);
    // 出力の欄: shell で貼らせ、その欄の説明そのものに、消してから貼ることを書く
    const output = yml.slice(yml.indexOf('id: output'), yml.indexOf('- type:', yml.indexOf('id: output')));
    expect(output).toMatch(/render: shell/);
    expect(output).toMatch(/description: .*住所.*ホスト名.*ユーザー名.*秘密の値.*消してから/);
    expect(yml).toMatch(/labels: \["stuck", "hands-on"\]/);
  });
});
