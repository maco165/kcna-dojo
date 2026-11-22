// 学ぶ予定をカレンダーに入れる .ics (RFC 5545) を作る。設定の画面で押したときにだけ読む。
// 中身はサイトの URL と短い文だけで、記録 (進み具合・受験日など) は入れない。
// DTSTART は端末の時刻帯 (TZID) で書き、RFC 5545 3.2.19 のとおり同じ TZID の VTIMEZONE を付ける
// (TZID だけで VTIMEZONE の無いファイルは、読めないカレンダーがある)。
import { SITE_ORIGIN } from './links';

export const SITE_URL = `${SITE_ORIGIN}/kcna-dojo/`;
export const ICS_SUMMARY = 'クラネイで KCNA-JP の学習';
export const ICS_DESCRIPTION = `今日のレッスンか復習を解く。${SITE_URL}`;
/** 予定の長さ (分) */
export const ICS_MINUTES = 30;
/** RRULE の BYDAY (Date#getDay の順: 日〜土) */
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

export type IcsPlan = {
  /** HH:MM (端末の時刻) */
  time: string;
  /** 学ぶ曜日 (0=日〜6=土)。7 つ全部なら毎日 */
  days: number[];
  /** IANA の時刻帯 (Asia/Tokyo など) */
  timeZone: string;
  now: Date;
  /** 予定の id。同じ予定を入れ直したときに重ねないよう、呼ぶ側が作る */
  uid: string;
};

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
/** 壁時計の日時 (YYYYMMDDTHHMMSS) */
const wall = (y: number, mo: number, d: number, h: number, mi: number, s = 0) => `${pad(y, 4)}${pad(mo)}${pad(d)}T${pad(h)}${pad(mi)}${pad(s)}`;
const utcStamp = (t: Date) => `${wall(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate(), t.getUTCHours(), t.getUTCMinutes(), t.getUTCSeconds())}Z`;

/** TEXT の値の書き方 (RFC 5545 3.3.11): \ ; , と改行を逃がす */
export const escapeText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** 1 行を 75 octet (UTF-8) ごとに折る (RFC 5545 3.1)。続きの行は空白 1 つで始め、その空白も 75 に数える。文字の途中では切らない */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  let size = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (size + n > 75) {
      out.push(cur);
      cur = ' ';
      size = 1;
    }
    cur += ch;
    size += n;
  }
  out.push(cur);
  return out.join('\r\n');
}

/** その時刻帯での、その時点の UTC からのずれ (分) */
export function offsetMinutes(timeZone: string, t: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
      .formatToParts(t)
      .map((p) => [p.type, Number(p.value)]),
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asUtc - Math.floor(t.getTime() / 1000) * 1000) / 60000);
}

const fmtOffset = (m: number) => `${m < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(m) / 60))}${pad(Math.abs(m) % 60)}`;

/** year の年に、時刻帯のずれが変わる時点 (変わった直後の時刻) と前後のずれ */
export function transitions(timeZone: string, year: number): { at: Date; from: number; to: number }[] {
  const out: { at: Date; from: number; to: number }[] = [];
  const day = 86_400_000;
  let t = Date.UTC(year, 0, 1);
  let prev = offsetMinutes(timeZone, new Date(t));
  for (; t < Date.UTC(year + 1, 0, 1); t += day) {
    const next = offsetMinutes(timeZone, new Date(t + day));
    if (next === prev) continue;
    // 1 日の中を分の単位で二分探索する
    let lo = t;
    let hi = t + day;
    while (hi - lo > 60_000) {
      const mid = lo + Math.floor((hi - lo) / 120_000) * 60_000;
      if (offsetMinutes(timeZone, new Date(mid)) === prev) lo = mid;
      else hi = mid;
    }
    out.push({ at: new Date(hi), from: prev, to: next });
    prev = next;
  }
  return out;
}

/** VTIMEZONE。ずれが変わらない時刻帯は STANDARD だけ。夏時間のある時刻帯は、去年の切り替えを起点に毎年の決まり (n 番目か最後の何曜日) を付ける */
export function vtimezone(timeZone: string, now: Date): string[] {
  const year = now.getFullYear() - 1;
  const ts = transitions(timeZone, year);
  const lines = ['BEGIN:VTIMEZONE', `TZID:${timeZone}`];
  if (ts.length === 0) {
    const off = fmtOffset(offsetMinutes(timeZone, now));
    lines.push('BEGIN:STANDARD', 'DTSTART:19700101T000000', `TZOFFSETFROM:${off}`, `TZOFFSETTO:${off}`, 'END:STANDARD');
  } else {
    const max = Math.max(...ts.map((x) => x.to));
    for (const x of ts) {
      // 切り替えの時刻は、切り替える前の壁時計で書く
      const local = new Date(x.at.getTime() + x.from * 60_000);
      const y = local.getUTCFullYear();
      const mo = local.getUTCMonth() + 1;
      const d = local.getUTCDate();
      const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
      const nth = d + 7 > last ? -1 : Math.ceil(d / 7);
      const kind = x.to === max && x.to !== x.from && ts.length > 1 ? 'DAYLIGHT' : 'STANDARD';
      lines.push(
        `BEGIN:${kind}`,
        `DTSTART:${wall(y, mo, d, local.getUTCHours(), local.getUTCMinutes())}`,
        `TZOFFSETFROM:${fmtOffset(x.from)}`,
        `TZOFFSETTO:${fmtOffset(x.to)}`,
        ...(ts.length > 1 ? [`RRULE:FREQ=YEARLY;BYMONTH=${mo};BYDAY=${nth}${BYDAY[local.getUTCDay()]}`] : []),
        `END:${kind}`,
      );
    }
  }
  lines.push('END:VTIMEZONE');
  return lines;
}

/** 最初の予定の日: 今日 (時刻がまだ来ていなければ) から、選んだ曜日に当たる最初の日 (端末の時刻) */
export function firstDay(plan: Pick<IcsPlan, 'time' | 'days' | 'now'>): Date {
  const [h, m] = plan.time.split(':').map(Number);
  for (let i = 0; i < 8; i++) {
    const d = new Date(plan.now.getFullYear(), plan.now.getMonth(), plan.now.getDate() + i, h, m);
    if (plan.days.includes(d.getDay()) && d.getTime() > plan.now.getTime()) return d;
  }
  throw new Error('学ぶ曜日を 1 つ以上選んでください');
}

/** .ics の中身 (CRLF の改行で、最後の行も CRLF で終える) */
export function buildIcs(plan: IcsPlan): string {
  const days = [...new Set(plan.days)].filter((d) => d >= 0 && d <= 6).sort();
  if (days.length === 0) throw new Error('学ぶ曜日を 1 つ以上選んでください');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(plan.time)) throw new Error('時刻は HH:MM で');
  const start = firstDay({ ...plan, days });
  const rrule = days.length === 7 ? 'RRULE:FREQ=DAILY' : `RRULE:FREQ=WEEKLY;BYDAY=${days.map((d) => BYDAY[d]).join(',')}`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//kcna-dojo//study plan//JA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...vtimezone(plan.timeZone, plan.now),
    'BEGIN:VEVENT',
    `UID:${plan.uid}`,
    `DTSTAMP:${utcStamp(plan.now)}`,
    `DTSTART;TZID=${plan.timeZone}:${wall(start.getFullYear(), start.getMonth() + 1, start.getDate(), start.getHours(), start.getMinutes())}`,
    `DURATION:PT${ICS_MINUTES}M`,
    rrule,
    `SUMMARY:${escapeText(ICS_SUMMARY)}`,
    `DESCRIPTION:${escapeText(ICS_DESCRIPTION)}`,
    `URL:${SITE_URL}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** 端末の時刻帯。取れなければ UTC */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** 予定の id (乱数と時刻。記録とは結び付けない) */
export const newUid = (now: Date = new Date(), random: () => number = Math.random) => `${now.getTime().toString(36)}-${Math.floor(random() * 36 ** 8).toString(36)}@maco165.github.io`;

/** .ics を保存させる */
export function downloadIcs(text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kcna-study.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
