import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import LoginForm from "./LoginForm";

type Props = {
  searchParams: Promise<{ return?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const s = await getSession();
  if (s.adminIdx) redirect(sp.return ?? "/dashboard");

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "36px 32px",
        }}
      >
        <h1
          className="h4"
          style={{
            textAlign: "center",
            fontWeight: 700,
            letterSpacing: "0.04em",
            marginBottom: 6,
            background:
              "linear-gradient(90deg, var(--accent-cyan), var(--accent-violet))",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          CONTROL
        </h1>
        <p
          style={{
            textAlign: "center",
            color: "var(--text-secondary)",
            fontSize: 14,
            marginBottom: 28,
          }}
        >
          관리자 로그인
        </p>
        {sp.error && (
          <div
            style={{
              background: "rgba(220, 53, 69, 0.10)",
              border: "1px solid rgba(220, 53, 69, 0.35)",
              color: "#ff8a96",
              borderRadius: 10,
              padding: "8px 12px",
              fontSize: 14,
              marginBottom: 12,
            }}
          >
            {decodeURIComponent(sp.error)}
          </div>
        )}
        <LoginForm returnUrl={sp.return ?? "/dashboard"} />
      </div>
    </div>
  );
}
