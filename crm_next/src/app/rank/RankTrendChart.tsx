"use client";

import { useEffect, useRef } from "react";

declare global { interface Window { Chart?: any } }

export default function RankTrendChart({ labels, data }: { labels: string[]; data: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let chart: any;
    let cancelled = false;

    async function ensureChart() {
      if (window.Chart) return window.Chart;
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("chart.js load failed"));
        document.head.appendChild(s);
      });
      return window.Chart;
    }

    (async () => {
      const Chart = await ensureChart();
      if (cancelled || !Chart || !ref.current) return;
      chart = new Chart(ref.current, {
        type: "line",
        data: {
          labels,
          datasets: [{
            label: "순위",
            data,
            borderColor: "#0d6efd",
            backgroundColor: "rgba(13, 110, 253, 0.12)",
            tension: 0.3,
            fill: true,
            pointRadius: 3,
          }],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              reverse: true,
              beginAtZero: false,
              ticks: { precision: 0, callback: (v: number) => v + "위" },
            },
          },
        },
      });
    })();

    return () => { cancelled = true; try { chart?.destroy(); } catch {} };
  }, [labels, data]);

  return <canvas ref={ref} height={90}></canvas>;
}
