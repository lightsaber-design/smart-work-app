// Pragmatic OSM `opening_hours` evaluator. Returns:
//   true  → currently open
//   false → currently closed (known)
//   null  → unknown / couldn't parse confidently
//
// OSM opening_hours is a rich grammar; we only handle the common shapes seen in
// the wild (day ranges + time ranges, "24/7", "off"/"closed", multiple rules).
// Anything we don't recognise resolves to `null` so callers can stay lenient.

const DAY_ORDER = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;
const DAY_INDEX: Record<string, number> = { Mo: 0, Tu: 1, We: 2, Th: 3, Fr: 4, Sa: 5, Su: 6 };
const JS_DAY_TO_TOKEN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function expandDays(spec: string): Set<string> {
  const set = new Set<string>();
  for (const part of spec.split(",")) {
    const p = part.trim();
    if (!p) continue;
    const range = p.match(/^([A-Za-z]{2})-([A-Za-z]{2})$/);
    if (range) {
      const a = DAY_INDEX[cap(range[1])];
      const b = DAY_INDEX[cap(range[2])];
      if (a == null || b == null) continue;
      let i = a;
      // walk forward (wrapping) until we pass the end day
      for (let guard = 0; guard < 7; guard++) {
        set.add(DAY_ORDER[i]);
        if (i === b) break;
        i = (i + 1) % 7;
      }
    } else if (DAY_INDEX[cap(p)] != null) {
      set.add(cap(p));
    }
  }
  return set;
}

function timeMatches(times: string, minutes: number): boolean {
  for (const range of times.split(",")) {
    const m = range.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
    if (!m) continue;
    const start = Number(m[1]) * 60 + Number(m[2]);
    let end = Number(m[3]) * 60 + Number(m[4]);
    if (end === 0) end = 24 * 60; // "00:00" as a closing time means midnight
    if (end <= start) end += 24 * 60; // crosses midnight
    const mins = minutes < start ? minutes + 24 * 60 : minutes;
    if (mins >= start && mins < end) return true;
  }
  return false;
}

export function isOpenNow(spec: string | undefined, now: Date = new Date()): boolean | null {
  if (!spec) return null;
  const s = spec.trim();
  if (!s) return null;
  if (/24\s*\/\s*7/.test(s)) return true;

  const today = JS_DAY_TO_TOKEN[now.getDay()];
  const minutes = now.getHours() * 60 + now.getMinutes();

  let parsedAnyRule = false;
  let appliedToday = false;
  let uncertain = false;

  for (const ruleRaw of s.split(";")) {
    const rule = ruleRaw.trim();
    if (!rule) continue;
    if (/^(PH|SH)\b/i.test(rule)) continue; // public/school holidays — ignore

    const timeToken = rule.match(/\d{1,2}:\d{2}/);
    let dayPart: string;
    let timePart: string;
    if (timeToken) {
      const idx = rule.indexOf(timeToken[0]);
      dayPart = rule.slice(0, idx).trim();
      timePart = rule.slice(idx).trim();
    } else {
      dayPart = rule.replace(/\b(off|closed)\b/i, "").trim();
      timePart = /\b(off|closed)\b/i.test(rule) ? "off" : "";
    }

    // A day part that isn't day-shaped (e.g. month ranges "Apr-Oct") → can't trust.
    let days: Set<string> | null = null;
    if (dayPart) {
      days = expandDays(dayPart);
      if (days.size === 0) { uncertain = true; continue; }
    }
    parsedAnyRule = true;

    const appliesToday = !days || days.has(today);
    if (!appliesToday) continue;
    appliedToday = true;

    if (timePart === "off" || /\b(off|closed)\b/i.test(timePart)) return false;
    if (timePart && timeMatches(timePart, minutes)) return true;
  }

  if (!parsedAnyRule) return null;
  if (uncertain && !appliedToday) return null;
  // Parsed rules apply, but none cover the current moment → closed.
  return appliedToday ? false : null;
}
