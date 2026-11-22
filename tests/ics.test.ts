import { describe, expect, it } from 'vitest';
import { ICS_DESCRIPTION, buildIcs, escapeText, firstDay, foldLine, offsetMinutes, transitions, vtimezone } from '../src/lib/ics';

const enc = new TextEncoder();
const unfold = (t: string) => t.replace(/\r\n /g, '');
const lines = (t: string) => unfold(t).split('\r\n').slice(0, -1);
/** 端末の時刻の 2026-11-25 (水) 21:00 */
const now = new Date(2026, 10, 25, 21, 0);

describe('.ics の形 (RFC 5545)', () => {
  const text = buildIcs({ time: '20:00', days: [1, 3, 5], timeZone: 'Asia/Tokyo', now, uid: 'abc@maco165.github.io' });

  it('どの行も CRLF で終わり (最後の行も)、75 octet 以内。ほどくと元の行になる', () => {
    expect(text.endsWith('\r\n')).toBe(true);
    expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    for (const l of text.split('\r\n')) expect(enc.encode(l).length).toBeLessThanOrEqual(75);
    expect(lines(text)).toContain(`DESCRIPTION:${escapeText(ICS_DESCRIPTION)}`);
  });

  it('折り返しは UTF-8 の文字の途中で切らない', () => {
    const long = `SUMMARY:${'学'.repeat(60)}`;
    const folded = foldLine(long);
    for (const l of folded.split('\r\n')) {
      expect(enc.encode(l).length).toBeLessThanOrEqual(75);
      expect(l).not.toContain('�');
    }
    expect(folded.replace(/\r\n /g, '')).toBe(long);
  });

  it('VCALENDAR の中に VTIMEZONE と VEVENT。VEVENT は UID・DTSTAMP・DTSTART (TZID)・RRULE を持つ', () => {
    const ls = lines(text);
    expect(ls[0]).toBe('BEGIN:VCALENDAR');
    expect(ls.at(-1)).toBe('END:VCALENDAR');
    expect(ls).toContain('VERSION:2.0');
    expect(ls.some((l) => l.startsWith('PRODID:'))).toBe(true);
    const ev = ls.slice(ls.indexOf('BEGIN:VEVENT'), ls.indexOf('END:VEVENT'));
    expect(ev).toContain('UID:abc@maco165.github.io');
    expect(ev.find((l) => l.startsWith('DTSTAMP:'))).toMatch(/^DTSTAMP:\d{8}T\d{6}Z$/);
    // 水曜 21:00 の後で最初の月・水・金の 20:00 は金曜 11/27
    expect(ev).toContain('DTSTART;TZID=Asia/Tokyo:20261127T200000');
    expect(ev).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR');
    expect(ev).toContain('DURATION:PT30M');
    expect(ls.indexOf('TZID:Asia/Tokyo')).toBeLessThan(ls.indexOf('BEGIN:VEVENT'));
  });

  it('中身はサイトの URL と決まった文だけ (記録を入れない)', () => {
    const values = lines(text).filter((l) => /^(SUMMARY|DESCRIPTION|URL):/.test(l));
    expect(values).toEqual(['SUMMARY:クラネイで KCNA-JP の学習', 'DESCRIPTION:今日のレッスンか復習を解く。https://maco165.github.io/kcna-dojo/', 'URL:https://maco165.github.io/kcna-dojo/']);
  });

  it('毎日は FREQ=DAILY。時刻がまだ来ていなければ今日から', () => {
    const daily = lines(buildIcs({ time: '22:30', days: [0, 1, 2, 3, 4, 5, 6], timeZone: 'Asia/Tokyo', now, uid: 'x' }));
    expect(daily).toContain('RRULE:FREQ=DAILY');
    expect(daily).toContain('DTSTART;TZID=Asia/Tokyo:20261125T223000');
    expect(firstDay({ time: '20:00', days: [3], now }).getDate()).toBe(2); // 今日 (水) の 20:00 は過ぎたので次の水曜 12/2
  });

  it('曜日が無い・時刻の形が違うときは作らない', () => {
    expect(() => buildIcs({ time: '20:00', days: [], timeZone: 'Asia/Tokyo', now, uid: 'x' })).toThrow();
    expect(() => buildIcs({ time: '25:00', days: [1], timeZone: 'Asia/Tokyo', now, uid: 'x' })).toThrow();
  });

  it('TEXT の , ; \\ と改行を逃がす', () => {
    expect(escapeText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });
});

/** VTIMEZONE の行から、UTC の時点のずれ (分) を求める (観測の DTSTART は切り替える前の壁時計。RRULE は使わない) */
function offsetFromVtimezone(lines: string[], t: number): number {
  const obs: { onset: number; from: number; to: number }[] = [];
  const mins = (v: string) => (v[0] === '-' ? -1 : 1) * (Number(v.slice(1, 3)) * 60 + Number(v.slice(3, 5)));
  let cur: Record<string, string> = {};
  for (const l of lines) {
    if (l === 'BEGIN:STANDARD' || l === 'BEGIN:DAYLIGHT') cur = {};
    else if (l === 'END:STANDARD' || l === 'END:DAYLIGHT') {
      const d = cur.DTSTART;
      const from = mins(cur.TZOFFSETFROM);
      const wallMs = Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8), +d.slice(9, 11), +d.slice(11, 13));
      obs.push({ onset: wallMs - from * 60_000, from, to: mins(cur.TZOFFSETTO) });
    } else {
      const i = l.indexOf(':');
      cur[l.slice(0, i)] = l.slice(i + 1);
    }
  }
  obs.sort((x, y) => x.onset - y.onset);
  let off = obs[0].from;
  for (const o of obs) if (o.onset <= t) off = o.to;
  return off;
}

describe('VTIMEZONE', () => {
  it('夏時間の無い時刻帯は STANDARD だけ', () => {
    expect(vtimezone('Asia/Tokyo', now)).toEqual(['BEGIN:VTIMEZONE', 'TZID:Asia/Tokyo', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0900', 'TZOFFSETTO:+0900', 'END:STANDARD', 'END:VTIMEZONE']);
    expect(offsetMinutes('Asia/Kolkata', now)).toBe(330);
  });

  it('切り替えを去年から 5 年先まで 1 つずつ書き、RRULE は使わない (ニューヨーク)', () => {
    const tz = vtimezone('America/New_York', now);
    expect(tz.join('\n')).toContain('BEGIN:DAYLIGHT\nDTSTART:20250309T020000\nTZOFFSETFROM:-0500\nTZOFFSETTO:-0400\nEND:DAYLIGHT');
    expect(tz.join('\n')).toContain('BEGIN:STANDARD\nDTSTART:20311102T020000\nTZOFFSETFROM:-0400\nTZOFFSETTO:-0500\nEND:STANDARD');
    expect(tz.filter((l) => l.startsWith('RRULE'))).toEqual([]);
    expect(tz.filter((l) => l === 'BEGIN:DAYLIGHT')).toHaveLength(7); // 2025〜2031
  });

  it('切り替えの時点を分まで求める', () => {
    const [spring] = transitions('America/New_York', 2025);
    expect(spring.at.toISOString()).toBe('2025-03-09T07:00:00.000Z');
  });

  it('Node の全時刻帯で、2026-11-23〜2029-11-22 の毎日のずれが Intl と同じ', () => {
    const zones = Intl.supportedValuesOf('timeZone');
    expect(zones.length).toBeGreaterThan(300);
    const bad: string[] = [];
    for (const tz of zones) {
      const lines = vtimezone(tz, now);
      for (let t = Date.UTC(2026, 10, 23, 12); t <= Date.UTC(2029, 10, 22, 12); t += 86_400_000) {
        const want = offsetMinutes(tz, new Date(t));
        if (offsetFromVtimezone(lines, t) !== want) {
          bad.push(`${tz} ${new Date(t).toISOString().slice(0, 10)}`);
          break;
        }
      }
    }
    expect(bad).toEqual([]);
  }, 180_000);
});
