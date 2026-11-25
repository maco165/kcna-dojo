import { describe, expect, it } from 'vitest';
// @ts-expect-error 検査の規則は JS
import { privateWords } from '../scripts/private-words.mjs';

// 例に出す名前は、どれも作り物
const words = (t: string): string[] => privateWords(t, []);

describe('載せてはいけない名前・住所', () => {
  it.each([
    'taro@my-pc.local', 'taro@10.0.0.5', 'ubuntu@my-pc.local', 'Taro@mypc', 'taro@mypc:~$ ls', 'taro@kcna', 'ubuntu@mypc', 'taro@example.com', 'taro.yamada+kcna@example.co.jp',
    'ssh://taro@mypc/path', 'https://taro@mypc.example/path', 'https://example.com/ を見る。taro@mypc に入る', 'https://example.com/を見たら /home/taro へ', 'git@gitlab.mypc.local', 'user@1001.service',
    '/home/taro', '/home/taro/.kube', '/Users/taro', 'C:\\Users\\taro', 'C:/Users/taro', '/mnt/home/taro', 'file:///home/taro/x', 'my-pc.local:/home/taro', '/home/ubuntu2',
    '192.168.1.1', 'https://192.168.1.1/x', 'Slave-1', 'PiHole', 'pi-hole', 'KEYCLOAK', 'K3s-Home',
  ])('落とす: %s', (t) => {
    expect(words(t)).not.toEqual([]);
  });

  it.each([
    'ubuntu@kcna:~$ ls', 'root@kcna:~#', 'です。root@kcna', 'ubuntu@kcna。', 'ubuntu@kcna.', '/home/ubuntu', '/home/ubuntu.', '/home/ubuntu/x', '/Users/Shared', 'C:\\Users\\Public', '/home/$USER', '/home/',
    'nginx@sha256:0123abcd', 'docker.io/library/nginx:1.27@sha256:0123abcd', 'kubernetes-admin@kubernetes', 'git@github.com:kubernetes/kubernetes.git', 'user@1000.service',
    'https://medium.com/@someone/post', 'https://unpkg.com/react@18.3.1/index.js', 'pkg@1.2', '@scope/pkg@1.2.3-beta.1', 'actions/checkout@v4', 'pkg@latest',
    'https://example.com/home/someone', 'docs.example.com/a/home/someone', 'https://example.com/a/Users/someone', '10.42.0.9', 'macOS', '@ だけ',
  ])('通す: %s', (t) => {
    expect(words(t)).toEqual([]);
  });
});
