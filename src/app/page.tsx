"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const [status, setStatus] = useState<string>("Checking...");

  useEffect(() => {
    async function test() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        setStatus(`Connected ✅ (session: ${data.session ? "yes" : "no"})`);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        setStatus(`Error ❌ ${message}`);
      }
    }
    test();
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>Presales Assessment</h1>
      <p>{status}</p>
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <Link href="/simulation">Go to Simulation</Link>
        <Link href="/assessment360">Go to 360 Assessment (MVP)</Link>
      </div>
    </main>
  );
}
