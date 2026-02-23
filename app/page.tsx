const endpoints = [
  "GET /api/health",
  "GET/POST /api/organizations",
  "GET/POST /api/locations",
  "GET/POST /api/materials",
  "GET/POST /api/suppliers",
  "GET/POST /api/teams",
  "POST /api/teams/:id/members",
  "POST /api/stock/movements",
  "GET/POST /api/purchase-orders",
  "POST /api/purchase-orders/:id/receive",
  "GET /api/alerts/low-stock",
  "GET /api/reports/stock-health"
];

export default function HomePage() {
  return (
    <main>
      <h1>LockStock API Scaffold</h1>
      <p>Base implementation for a solopreneur-friendly stock management app built with Next.js + Supabase.</p>

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
          4. Pass <code>x-org-id</code> and <code>x-user-id</code> headers to API requests.
        </p>
      </section>

      <section className="card">
        <h2>Implemented Endpoints</h2>
        {endpoints.map((endpoint) => (
          <p key={endpoint}>
            <code>{endpoint}</code>
          </p>
        ))}
      </section>
    </main>
  );
}
