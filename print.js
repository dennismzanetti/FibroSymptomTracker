// ---- Print support ----

function setupPrint() {
  const printBtn = document.getElementById("printMedBtn");
  if (printBtn) {
    printBtn.removeAttribute("onclick");
    printBtn.addEventListener("click", printMedList);
  }
}

async function printMedList() {
  const printBtn = document.getElementById("printMedBtn");
  if (printBtn) { printBtn.disabled = true; printBtn.textContent = "Loading\u2026"; }

  try {
    const [medSnap, suppSnap] = await Promise.all([
      db.collection("medications").orderBy("name").get(),
      db.collection("supplements").orderBy("name").get()
    ]);

    const meds = [];
    medSnap.forEach(doc => meds.push({ id: doc.id, ...doc.data() }));
    const supps = [];
    suppSnap.forEach(doc => supps.push({ id: doc.id, ...doc.data() }));

    const now = new Date();
    const dateStr = now.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

    const medRows = meds.length
      ? meds.map(m => `<tr>
          <td>${m.name || ""}</td>
          <td>${m.dose || ""}</td>
          <td>${FREQ_LABELS[m.frequency] || m.frequency || ""}</td>
          <td>${m.prescribedFor || ""}</td>
          <td>${m.prescribedBy || ""}</td>
          <td>${m.notes || ""}</td>
        </tr>`).join("")
      : `<tr><td colspan="6" style="text-align:center;color:#888;">No medications on file.</td></tr>`;

    const suppRows = supps.length
      ? supps.map(s => `<tr>
          <td>${s.name || ""}</td>
          <td>${s.dose || ""}</td>
          <td>${FREQ_LABELS[s.frequency] || s.frequency || ""}</td>
          <td>${s.purpose || ""}</td>
          <td>${s.brand || ""}</td>
          <td>${s.notes || ""}</td>
        </tr>`).join("")
      : `<tr><td colspan="6" style="text-align:center;color:#888;">No supplements on file.</td></tr>`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Medication &amp; Supplement List</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; margin: 24px; color: #222; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    .subtitle { color: #666; margin-bottom: 20px; font-size: 11px; }
    h2 { font-size: 14px; margin: 20px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th { background: #f0f0f0; text-align: left; padding: 6px 8px; font-size: 11px; border: 1px solid #ddd; }
    td { padding: 5px 8px; border: 1px solid #ddd; vertical-align: top; }
    tr:nth-child(even) td { background: #fafafa; }
    @media print { body { margin: 12px; } }
  </style>
</head>
<body>
  <h1>Medication &amp; Supplement List</h1>
  <div class="subtitle">Printed on ${dateStr}</div>

  <h2>Medications</h2>
  <table>
    <thead><tr><th>Name</th><th>Dose</th><th>Frequency</th><th>Prescribed For</th><th>Prescriber</th><th>Notes</th></tr></thead>
    <tbody>${medRows}</tbody>
  </table>

  <h2>Supplements</h2>
  <table>
    <thead><tr><th>Name</th><th>Dose</th><th>Frequency</th><th>Purpose</th><th>Brand</th><th>Notes</th></tr></thead>
    <tbody>${suppRows}</tbody>
  </table>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) { alert("Pop-up blocked. Please allow pop-ups for this site."); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  } catch (err) {
    console.error("printMedList error:", err);
    alert("Failed to load data for printing.");
  } finally {
    if (printBtn) { printBtn.disabled = false; printBtn.textContent = "Print Med List"; }
  }
}
