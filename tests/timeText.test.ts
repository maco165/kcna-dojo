import { describe, expect, it } from 'vitest';
import { normalizeTime } from '../src/lib/timeText';

describe('.ics の時刻の欄', () => {
  it('HH:MM にそろえる (全角・1 桁・コロンなしも読む)', () => {
    expect(['20:00', '8:05', '８：３０', '2030', '930', ' 07:5 '].map(normalizeTime)).toEqual(['20:00', '08:05', '08:30', '20:30', '09:30', '07:05']);
  });
  it('読めない・範囲の外は null', () => {
    expect(['', '24:00', '12:60', 'abc', '1:2:3', '12345'].map(normalizeTime)).toEqual([null, null, null, null, null, null]);
  });
});
