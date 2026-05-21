async function refreshHistory() {
  const historyList = document.getElementById("historyList");
  if (!historyList) return;
  historyList.innerHTML = "<p>Loading history...</p>";
  try {
    const snapshot = await db.collection("days")
      .orderBy(firebase.firestore.FieldPath.documentId(), "desc")
      .limit(30)
      .get();
    if (snapshot.empty) {
      historyList.innerHTML = "<p>No entries found.</p>";
      return;
    }
    historyList.innerHTML = "";
    snapshot.forEach((doc) => {
      const d = doc.data();
      const dateLabel = getJournalDateLine(doc.id);
      const avg = typeof d.avgFunctionality === "number" ? d.avgFunctionality : null;

      let scorePill;
      if (avg !== null) {
        const tier = avg <= 3 ? 1 : avg <= 6 ? 2 : avg < 10 ? 3 : 4;
        scorePill = `<span class="mood-score-pill mood-score-${tier}">${avg.toFixed(1)}/10</span>`;
      } else {
        scorePill = `<span class="mood-score-empty">\u2014</span>`;
      }

      const li = document.createElement("li");
      li.style.cursor = "pointer";
      li.innerHTML = `
        <span class="history-date-label">${dateLabel}</span>
        <span class="history-score-wrap">
          <span class="history-score-label">Avg Score</span>
          ${scorePill}
        </span>`;
      li.addEventListener("click", () => {
        loadDayFromCloud(doc.id);
        switchToTab("entry-tab");
      });
      historyList.appendChild(li);
    });
  } catch (err) {
    console.error("refreshHistory error:", err);
    historyList.innerHTML = "<p>Failed to load history.</p>";
  }
}
