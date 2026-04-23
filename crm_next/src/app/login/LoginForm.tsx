"use client";

export default function LoginForm({ returnUrl }: { returnUrl: string }) {
  return (
    <form method="post" action="/api/login" autoComplete="off">
      <input type="hidden" name="return" value={returnUrl} />
      <div className="mb-3">
        <label className="form-label small fw-bold" style={{ color: "var(--text-secondary)" }}>
          아이디
        </label>
        <input
          type="text"
          name="id"
          className="form-control"
          required
          autoFocus
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-strong)",
            color: "var(--text-primary)",
            borderRadius: 10,
            padding: "10px 12px",
          }}
        />
      </div>
      <div className="mb-3">
        <label className="form-label small fw-bold" style={{ color: "var(--text-secondary)" }}>
          비밀번호
        </label>
        <input
          type="password"
          name="pw"
          className="form-control"
          required
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-strong)",
            color: "var(--text-primary)",
            borderRadius: 10,
            padding: "10px 12px",
          }}
        />
      </div>
      <button
        type="submit"
        className="btn w-100"
        style={{
          background: "var(--accent-cyan)",
          color: "#0A0E1A",
          border: "1px solid var(--accent-cyan)",
          fontWeight: 700,
          letterSpacing: "0.02em",
          borderRadius: 10,
          padding: "10px 14px",
        }}
      >
        로그인
      </button>
    </form>
  );
}
