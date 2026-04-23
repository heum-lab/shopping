"use client";

import { useEffect, useRef } from "react";

type Props = {
  channelLabels: string[];
  channelTotals: number[];
  statusLabels: string[];
  statusValues: number[];
  trendLabels: string[];
  trendData: number[];
};

declare global {
  interface Window { Chart?: any }
}

export default function DashboardCharts(props: Props) {
  const channelRef = useRef<HTMLCanvasElement>(null);
  const statusRef = useRef<HTMLCanvasElement>(null);
  const trendRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const charts: any[] = [];

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
      if (cancelled || !Chart) return;

      Chart.defaults.color = "#5A6178";
      Chart.defaults.borderColor = "#252B3D";
      Chart.defaults.font.family = '"Pretendard","Noto Sans KR",sans-serif';

      const palette = ["#00E5FF","#8B5CF6","#5dd6a0","#ffc66e","#ff6b76","#a78bfa","#22d3ee","#facc15","#94a3b8","#f472b6"];
      const darkAxis = {
        ticks: { color: "#8B93A7", precision: 0 },
        grid:  { color: "rgba(37, 43, 61, 0.6)", drawBorder: false },
      };

      if (channelRef.current) {
        charts.push(new Chart(channelRef.current, {
          type: "bar",
          data: {
            labels: props.channelLabels,
            datasets: [{
              label: "총 작업",
              data: props.channelTotals,
              backgroundColor: "rgba(0, 229, 255, 0.55)",
              borderColor: "#00E5FF",
              borderWidth: 1,
              borderRadius: 6,
              hoverBackgroundColor: "#00E5FF",
            }],
          },
          options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { x: darkAxis, y: { ...darkAxis, beginAtZero: true } },
          },
        }));
      }

      if (statusRef.current) {
        charts.push(new Chart(statusRef.current, {
          type: "doughnut",
          data: {
            labels: props.statusLabels,
            datasets: [{
              data: props.statusValues,
              backgroundColor: palette,
              borderColor: "#121624",
              borderWidth: 2,
            }],
          },
          options: {
            responsive: true,
            plugins: { legend: { position: "right", labels: { color: "#8B93A7" } } },
          },
        }));
      }

      if (trendRef.current) {
        charts.push(new Chart(trendRef.current, {
          type: "line",
          data: {
            labels: props.trendLabels,
            datasets: [{
              label: "신규 등록",
              data: props.trendData,
              borderColor: "#00E5FF",
              backgroundColor: "rgba(0, 229, 255, 0.12)",
              tension: 0.35,
              fill: true,
              pointRadius: 2,
              pointBackgroundColor: "#00E5FF",
            }],
          },
          options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { x: darkAxis, y: { ...darkAxis, beginAtZero: true } },
          },
        }));
      }
    })();

    return () => {
      cancelled = true;
      for (const c of charts) { try { c.destroy(); } catch {} }
    };
  }, [props]);

  return (
    <>
      <div className="row g-2 mb-3">
        <div className="col-md-7">
          <div className="search-box">
            <h6 className="fw-bold mb-3">채널별 작업 수</h6>
            <canvas ref={channelRef} height={220}></canvas>
          </div>
        </div>
        <div className="col-md-5">
          <div className="search-box">
            <h6 className="fw-bold mb-3">
              상태 분포
            </h6>
            <canvas ref={statusRef} height={220}></canvas>
          </div>
        </div>
      </div>
      <div className="row g-2 mb-3">
        <div className="col-12">
          <div className="search-box">
            <h6 className="fw-bold mb-3">일별 신규 등록 추이</h6>
            <canvas ref={trendRef} height={80}></canvas>
          </div>
        </div>
      </div>
    </>
  );
}
