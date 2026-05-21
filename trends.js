let functionalityChart = null;

// Chart.js plugin: draws alternating background stripes per 7-day week
const weekStripePlugin = {
  id: "weekStripes",
  beforeDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea) return;
    const xScale = scales.x;
    const count = chart.data.labels.length;
    if (!count) return;

    const stripeColors = [
      "rgba(63, 81, 181, 0.06)",   // indigo tint — even weeks
      "rgba(63, 81, 181, 0.0)"     // transparent — odd weeks (clean contrast)
    ];

    ctx.save();
    for (let i = 0; i < count; i += 7) {
      const weekIndex = Math.floor(i / 7);
      const color = stripeColors[weekIndex % 2];
      if (!color || color === "rgba(63, 81, 181, 0.0)") continue; // skip transparent bands

      const startPx = xScale.getPixelForIndex(i);
      const endIndex = Math.min(i + 6, count - 1);
      const endPx = xScale.getPixelForIndex(endIndex);

      // Extend band to midpoints between adjacent data points for clean edges
      const halfStep = (xScale.getPixelForIndex(1) - xScale.getPixelForIndex(0)) / 2;
      const left = i === 0 ? chartArea.left : startPx - halfStep;
      const right = endIndex === count - 1 ? chartArea.right : endPx + halfStep;

      ctx.fillStyle = color;
      ctx.fillRect(left, chartArea.top, right - left, chartArea.bottom - chartArea.top);
    }
    ctx.restore();
  }
};

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
    // Reverse so chart runs oldest \u2192 newest
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
        },
        plugins: [weekStripePlugin]
      });
    }
  } catch (err) {
    console.error("refreshTrends error:", err);
  }
}
