let functionalityChart = null;
async function refreshTrends() {
  const ctx = document.getElementById("functionalityChart");
  if (!ctx) return;
  try {
    const snapshot = await db.collection("days")
      .orderBy(firebase.firestore.FieldPath.documentId(), "desc")
      .limit(90)
      .get();
    const rows = [];
    snapshot.forEach((doc) => {
      const d = doc.data();
      if (typeof d.avgFunctionality === "number") {
        rows.push({ date: doc.id, score: d.avgFunctionality.toFixed(1) });
      }
    });
    // Reverse so chart runs oldest → newest
    rows.reverse();
    const labels = rows.map(r => r.date);
    const data = rows.map(r => r.score);
    if (functionalityChart) {
      functionalityChart.data.labels = labels;
      functionalityChart.data.datasets[0].data = data;
      functionalityChart.update();
    } else {
      functionalityChart = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [{
            label: "Avg Functionality",
            data,
            borderColor: "#3f51b5",
            backgroundColor: "rgba(63,81,181,0.1)",
            fill: true,
            tension: 0.3,
            pointRadius: 4
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: true } },
          scales: { y: { min: 0, max: 10, title: { display: true, text: "Score (0\u201310)" } } }
        }
      });
    }
  } catch (err) {
    console.error("refreshTrends error:", err);
  }
}
