import { useEffect } from "react";
import { Landmark } from "lucide-react";
import { buildApiUrl } from "@/lib/apiClient";

export default function CapitalRedirect({ path }: { path: "/" | "/budget" | "/trading" }) {
  const href = buildApiUrl(`/api/capital/launch?path=${encodeURIComponent(path)}`);

  useEffect(() => {
    window.location.assign(href);
  }, [href]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 text-center">
      <div>
        <Landmark className="mx-auto h-8 w-8 text-cyan-300" />
        <h1 className="mt-4 text-xl font-semibold text-white">Opening ZILLION Prosper</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Budgeting, investing, and trading are owned by the Capital Desk.
        </p>
        <a className="mt-5 inline-block text-sm text-cyan-300 underline" href={href}>
          Continue
        </a>
      </div>
    </main>
  );
}
