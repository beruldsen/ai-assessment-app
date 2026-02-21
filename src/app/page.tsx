"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const [status, setStatus] = useState<string>("Checking...");

  useEffect(() => {
    async function test() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        setStatus(`Connected ✅ (session: ${data.session ? "yes" : "no"})`);
      } catch (e: any) {
        setStatus(`Error ❌ ${e.message ?? String(e)}`);
      }
    }
    test();
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>Presales Assessment</h1>
      <p>{status}</p>
    </main>
  );
}
