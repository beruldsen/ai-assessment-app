"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string>("");

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setMsg("Sending magic link...");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setMsg(error ? `Error: ${error.message}` : "Check your email for the link ✅");
  }

  return (
    <main style={{ padding: 24, maxWidth: 420 }}>
      <h1>Login</h1>
      <form onSubmit={signIn}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          style={{ width: "100%", padding: 10, marginTop: 12 }}
        />
        <button style={{ marginTop: 12, padding: 10, width: "100%" }}>
          Send magic link
        </button>
      </form>
      <p style={{ marginTop: 12 }}>{msg}</p>
    </main>
  );
}
