export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// 23810 -> "23.8k", 1200000 -> "1.2M" (axes); tooltips use the full number.
export function compact(n) {
  const a = Math.abs(n);
  if (a >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${+(n / 1e3).toFixed(a >= 1e4 && a % 1e3 === 0 ? 0 : 1)}k`;
  return String(n);
}
export const full = (n) => Number(n).toLocaleString("en-US");

// Round the axis max up to a "nice" number and return evenly spaced ticks.
export function niceScale(max, target = 5) {
  if (!(max > 0)) return { max: 1, ticks: [0, 1] };
  const raw = max / target;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw);
  const niceMax = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= niceMax + step / 2; v += step) ticks.push(+v.toFixed(6));
  return { max: niceMax, ticks };
}

// Months are 1-12 and windows may wrap the year end (e.g. [9,10,11,12,1]).
// Describe the set as ranges: "Sep–Jan", treating Dec->Jan as contiguous.
export function describeMonths(months = []) {
  const set = new Set(months);
  if (set.size === 0) return "";
  if (set.size === 12) return "All year";
  const runs = [];
  for (let m = 1; m <= 12; m++) {
    const prev = m === 1 ? 12 : m - 1;
    if (!set.has(m) || set.has(prev)) continue;
    let end = m;
    while (set.has(end === 12 ? 1 : end + 1)) end = end === 12 ? 1 : end + 1;
    runs.push(end === m ? MONTHS[m - 1] : `${MONTHS[m - 1]}–${MONTHS[end - 1]}`);
  }
  return runs.join(", ");
}

// Expand {from, to} (wrapping allowed) into a month list.
export function monthRange(from, to) {
  const out = [];
  let m = from;
  for (let i = 0; i < 12; i++) {
    out.push(m);
    if (m === to) break;
    m = m === 12 ? 1 : m + 1;
  }
  return out;
}

export function monthsOf(intake, key) {
  if (Array.isArray(intake[`${key}Months`])) return intake[`${key}Months`];
  const w = intake[`${key}Window`];
  return w ? monthRange(w.from, w.to) : [];
}

// A visa field is either a plain string or {value, asOf: "YYYY-MM", source, estimated}.
export const field = (v) => (v && typeof v === "object" ? v : { value: v });
export function fmtAsOf(asOf) {
  if (!asOf) return "";
  const [y, m] = String(asOf).split("-");
  return m ? `${MONTHS[+m - 1]} ${y}` : y;
}
