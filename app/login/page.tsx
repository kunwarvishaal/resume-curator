"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { safeNextPath } from "../../lib/safe-redirect";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Login failed.");
      const next = safeNextPath(searchParams.get("next"));
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: "360px",
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderRadius: "16px",
          padding: "32px",
          boxShadow: "var(--shadow-lg)",
          backdropFilter: "blur(16px)",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0, color: "var(--ink)" }}>Resume Curator</h1>
        <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: "6px", marginBottom: "24px" }}>
          Enter the app password to continue.
        </p>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          autoFocus
          style={{
            width: "100%",
            background: "var(--canvas)",
            border: "1px solid var(--line)",
            borderRadius: "10px",
            padding: "10px 12px",
            color: "var(--ink)",
            marginBottom: "16px",
            outline: "none",
          }}
        />
        {error && (
          <p style={{ color: "var(--danger)", fontSize: "0.85rem", marginBottom: "16px" }}>{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            background: "var(--sage-500)",
            color: "#03111e",
            fontWeight: 600,
            border: "none",
            borderRadius: "10px",
            padding: "10px 12px",
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Checking..." : "Enter"}
        </button>
      </form>
    </main>
  );
}
