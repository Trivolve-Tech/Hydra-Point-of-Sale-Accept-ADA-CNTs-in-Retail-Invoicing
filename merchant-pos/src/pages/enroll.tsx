import { useState } from "react";
import axios from "axios";

type EnrollResponse = {
  customer: { id: string; label?: string | null };
  head: { id: string; merchantApiPort: number; customerApiPort: number; state: string };
};

export default function EnrollPage() {
  const [label, setLabel] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<EnrollResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const { data } = await axios.post<EnrollResponse>("/api/customers/enroll", {
        label: label || undefined,
      });
      setResult(data);
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.error ?? err.message
          : err instanceof Error
            ? err.message
            : "unknown error",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-6 py-10 text-white">
      <header>
        <h1 className="text-2xl font-semibold">Customer enrollment</h1>
        <p className="mt-2 text-sm text-secondary">
          Opens a per-customer Hydra head. v1 pilot is fully custodial — both
          customer keys live on merchant infra. See{" "}
          <span className="font-mono">docs/ops/non-custody-spike.md</span>.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm">
          <span className="text-secondary">Label (optional)</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Café regular #1"
            className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-primary focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl border border-primary/40 bg-primary/15 px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-primary transition hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {pending ? "Opening head…" : "Enroll"}
        </button>
      </form>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
          <p className="font-semibold">Enrolled.</p>
          <p className="mt-2 font-mono text-xs text-white/70">
            customer: {result.customer.id}
            <br />
            head: {result.head.id}
            <br />
            merchantApiPort: {result.head.merchantApiPort} · customerApiPort:{" "}
            {result.head.customerApiPort}
            <br />
            state: {result.head.state}
          </p>
        </div>
      )}
    </main>
  );
}
