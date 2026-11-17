import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('public/favicon.svg', () => {
  it('XML として読める (コメントの中の -- などで壊れると、ブラウザが画像として出せない)', () => {
    const text = readFileSync(join(__dirname, '../public/favicon.svg'), 'utf8');
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(doc.documentElement.tagName).toBe('svg');
  });
});
