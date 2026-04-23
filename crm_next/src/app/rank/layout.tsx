import "@/app/globals.css";

export const metadata = { title: "순위 이력" };

export default function RankLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"
          rel="stylesheet"
        />
        <style>{`
          body { font-family: "Noto Sans KR", sans-serif; padding: 16px; background: #f5f6f8; color: #212529; }
          .rank-box { background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #dee2e6; }
          .rank-up   { color: #dc3545; }
          .rank-down { color: #0d6efd; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
