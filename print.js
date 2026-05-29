import { loadRange } from './cloud.js';
import { formatDateLong, datesInRange } from './date.js';

export async function printRange(startStr, endStr) {
  const days = datesInRange(startStr, endStr);
  const data = await loadRange(startStr, endStr);

  const lines = [];
  days.forEach(d => {
    const day = data[d];
    if (!day) return;
    lines.push(`\n=== ${formatDateLong(d)} ===`);
    if (day.pain) {
      const painParts = Object.entries(day.pain)
        .map(([k, v]) => `${k}: ${v}`).join(', ');
      lines.push(`Pain: ${painParts}`);
    }
    if (day.fatigue != null)    lines.push(`Fatigue: ${day.fatigue}`);
    if (day.sleep) {
      lines.push(`Sleep: ${day.sleep.hours}hrs, quality ${day.sleep.quality}`);
    }
    if (day.mood?.score != null) lines.push(`Mood: ${day.mood.score}${ day.mood.notes ? ' — ' + day.mood.notes : ''}`);
    if (day.symptoms?.length)   lines.push(`Symptoms: ${day.symptoms.join(', ')}`);
    if (day.generalNotes)       lines.push(`Notes: ${day.generalNotes}`);
    if (day.medicationNotes)    lines.push(`Medications: ${day.medicationNotes}`);
    if (day.activityNotes)      lines.push(`Activity: ${day.activityNotes}`);
    if (day.weatherNotes)       lines.push(`Weather: ${day.weatherNotes}`);
  });

  const win = window.open('', '_blank');
  win.document.write(`<pre style="font-family:monospace;font-size:13px;padding:2rem;">${lines.join('\n')}</pre>`);
  win.document.close();
  win.print();
}
