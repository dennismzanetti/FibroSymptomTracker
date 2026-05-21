// Chart.js plugin: draws alternating weekly background stripes
const weekStripePlugin = {
  id: "weekStripes",
  beforeDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea) return;
    const xScale = scales.x;
    const count = chart.data.labels.length;
    if (count < 2) return;

    const stripeColors = [
      "rgba(63, 81, 181, 0.07)",  // indigo tint — even weeks
      "rgba(0, 0, 0, 0)"          // transparent — odd weeks
    ];

    // In Chart.js v3 the correct method is getPixelForValue(index)
    const px = (i) => xScale.getPixelForValue(i);
    const halfStep = (px(1) - px(0)) / 2;

    ctx.save();
    for (let i = 0; i < count; i += 7) {
      const weekIndex = Math.floor(i / 7);
      const color = stripeColors[weekIndex % 2];
      const endIndex = Math.min(i + 6, count - 1);
      const left  = i === 0            ? chartArea.left  : px(i) - halfStep;
      const right = endIndex === count - 1 ? chartArea.right : px(endIndex) + halfStep;
      ctx.fillStyle = color;
      ctx.fillRect(left, chartArea.top, right - left, chartArea.bottom - chartArea.top);
    }
    ctx.restore();
  }
};

// Register globally once
if (!Chart.registry.plugins.get("weekStripes")) {
  Chart.register(weekStripePlugin);
}

async function refreshTrends() {
  const canvas = document.getElementById("functionalityChart");
  if (!canvas) return;

  // Destroy any existing chart on this canvas before reuse
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  try {
    const snapshot = await db.collection("days")
      .orderBy(firebase.firestore.FieldPath.documentId(), "desc")
      .limit(90)
      .get();

    const rows = [];
    snapshot.forEach((doc) => {
      const d = doc.data();
      if (typeof d.avgFunctionality === "number") {
        rows.push({ date: doc.id, score: parseFloat(d.avgFunctionality.toFixed(1)) });
      }
    });
    rows.reverse(); // oldest → newest

    const labels = rows.map(r => r.date);
    const data   = rows.map(r => r.score);

    new Chart(canvas, {
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
        scales: {
          y: { min: 0, max: 10, title: { display: true, text: "Score (0\u201310)" } }
        }
      }
    });
  } catch (err) {
    console.error("refreshTrends error:", err);
  }
}
