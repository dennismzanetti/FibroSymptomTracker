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
      const avg = typeof d.avgFunctionality === "number" ? d.avgFunctionality.toFixed(1) : "\u2014";
      const li = document.createElement("li");
      li.style.cursor = "pointer";
      li.innerHTML = `<strong>${dateLabel}</strong> \u2014 Avg functionality: ${avg}/10`;
      li.addEventListener("click", () => {
        loadDayFromCloud(doc.id);
        // Switch back to the Daily Entry tab
        switchToTab("entry-tab");
      });
      historyList.appendChild(li);
    });
  } catch (err) {
    console.error("refreshHistory error:", err);
    historyList.innerHTML = "<p>Failed to load history.</p>";
  }
}
