import { describe, expect, it } from 'vitest';
import { HANDBOOK_TOPICS } from '../src/content/handbook';
import { HANDBOOK_FIGURES } from '../src/content/handbookFigures';
import { expectGoodLayout } from './diagramLayout';

describe('ハンドブックの図', () => {
  it('どのトピックにも図があり、知らないトピックの図は無い', () => {
    const ids = HANDBOOK_TOPICS.map((t) => t.id).sort();
    expect(Object.keys(HANDBOOK_FIGURES).sort()).toEqual(ids);
  });
  for (const [id, f] of Object.entries(HANDBOOK_FIGURES)) {
    it(`${id}: 矢印は実在する箱を結び、箱は図の中に収まって重ならない`, () => expectGoodLayout(f));
  }
});
