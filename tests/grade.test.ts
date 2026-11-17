import { describe, expect, it } from 'vitest';
import { gradeChoice, gradeFill, normalizeAnswer } from '../src/lib/grade';

describe('gradeFill', () => {
  const q = { answers: ['get'] };

  it('前後の空白は無視する', () => {
    expect(gradeFill(q, '  get ')).toBe(true);
  });

  it('大文字と小文字は区別する', () => {
    expect(gradeFill(q, 'Get')).toBe(false);
    expect(gradeFill({ answers: ['Deployment'] }, 'deployment')).toBe(false);
  });

  it('別解の配列のどれでも正解', () => {
    const multi = { answers: ['CMD', 'ENTRYPOINT'] };
    expect(gradeFill(multi, 'CMD')).toBe(true);
    expect(gradeFill(multi, 'ENTRYPOINT')).toBe(true);
    expect(gradeFill(multi, 'RUN')).toBe(false);
  });

  it('空は不正解', () => {
    expect(gradeFill(q, '   ')).toBe(false);
  });

  it('間の空白の並びは 1 つとして比べる', () => {
    expect(normalizeAnswer(' -o   wide ')).toBe('-o wide');
    expect(gradeFill({ answers: ['-o wide'] }, '-o  wide')).toBe(true);
  });
});

describe('gradeChoice', () => {
  it('正解の id だけを正解にする', () => {
    expect(gradeChoice({ answer: 'b' }, 'b')).toBe(true);
    expect(gradeChoice({ answer: 'b' }, 'a')).toBe(false);
  });
});
