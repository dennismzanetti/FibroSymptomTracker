function todayStr() {
  const d = new Date();
  return localDateStr(d);
}

function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function parseDateLocal(str) {
  // Parse YYYY-MM-DD as local date (not UTC)
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateLong(dateStr) {
  const d = parseDateLocal(dateStr);
  return d.toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

function formatDateShort(dateStr) {
  const d = parseDateLocal(dateStr);
  return d.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric'
  });
}

function addDays(dateStr, n) {
  const d = parseDateLocal(dateStr);
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

function dayOfWeekShort(dateStr) {
  const d = parseDateLocal(dateStr);
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

function dayOfWeekLong(dateStr) {
  const d = parseDateLocal(dateStr);
  return d.toLocaleDateString(undefined, { weekday: 'long' });
}

function datesInRange(from, to) {
  const dates = [];
  let cur = from;
  while (cur <= to) {
    dates.push(cur);
    cur = addDays(cur, 1);
  }
  return dates;
}

function nDaysAgo(n) {
  return addDays(todayStr(), -n);
}
