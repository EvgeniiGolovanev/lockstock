import { LockstockWorkbench } from "@/components/lockstock-workbench";

export default function HomePage() {
  return (
    <main>
      <h1>LockStock Workbench</h1>
      <p>Use this page to bootstrap an organization and execute the core material workflow.</p>

      <section className="card">
        <h2>Setup</h2>
        <p>
          1. Copy <code>.env.example</code> to <code>.env.local</code>.
        </p>
        <p>
          2. Apply SQL from <code>supabase/migrations/202602231350_init.sql</code> to your Supabase project.
        </p>
        <p>
          3. Start app with <code>npm run dev</code>.
        </p>
        <p>
          4. Paste a valid Supabase access token below.
        </p>
      </section>

      <LockstockWorkbench />
    </main>
  );
}
