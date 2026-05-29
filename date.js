export function todayStr() {
  const d = new Date();
  return localDateStr(d);
}

export function localDateStr(d) {
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day   = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateLong(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

export function datesInRange(startStr, endStr) {
  const dates = [];
  let current = new Date(startStr + 'T12:00:00');
  const end   = new Date(endStr   + 'T12:00:00');
  while (current <= end) {
    dates.push(localDateStr(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export function defaultRangeStr(days = 30) {
  const end   = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { start: localDateStr(start), end: localDateStr(end) };
}
