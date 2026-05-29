export function todayStr() {
  const d = new Date();
  return localDateStr(d);
}

export function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function parseDateLocal(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateLong(dateStr) {
  const d = parseDateLocal(dateStr);
  return d.toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

export function formatDateShort(dateStr) {
  const d = parseDateLocal(dateStr);
  return d.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric'
  });
}

export function addDays(dateStr, n) {
  const d = parseDateLocal(dateStr);
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

export function dayOfWeekShort(dateStr) {
  const d = parseDateLocal(dateStr);
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

export function dayOfWeekLong(dateStr) {
  const d = parseDateLocal(dateStr);
  return d.toLocaleDateString(undefined, { weekday: 'long' });
}

export function datesInRange(from, to) {
  const dates = [];
  let cur = from;
  while (cur <= to) {
    dates.push(cur);
    cur = addDays(cur, 1);
  }
  return dates;
}

export function nDaysAgo(n) {
  return addDays(todayStr(), -n);
}
