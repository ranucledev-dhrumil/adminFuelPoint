import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, Wrench, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, Panel, StatusBadge } from "@/components/admin/primitives";
import { formatPhone, searchApi } from "@/services/adminService";

export const Route = createFileRoute("/_admin/search")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      q: (search["q"] as string) || "",
    };
  },
  component: SearchResultsPage,
});

function SearchResultsPage() {
  const { q } = Route.useSearch();
  const rawQ = q.trim();

  const searchQuery = useQuery({
    queryKey: ["admin", "search", rawQ],
    queryFn: () => searchApi.globalSearch(rawQ),
    enabled: Boolean(rawQ),
  });

  const customers = searchQuery.data?.customers ?? [];
  const workers = searchQuery.data?.workers ?? [];

  if (!rawQ) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Search"
          description="Enter a query in the top bar to search across customers and workers."
        />
        <Panel className="p-12 text-center text-muted-foreground">
          Type in the top bar to begin searching.
        </Panel>
      </div>
    );
  }

  const hasResults = customers.length > 0 || workers.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Search Results" description={`Showing results for "${rawQ}"`} />

      {searchQuery.isLoading && (
        <Panel className="p-12 text-center text-muted-foreground">Searching for "{rawQ}"…</Panel>
      )}

      {!searchQuery.isLoading && !hasResults && (
        <Panel className="p-12 text-center text-muted-foreground">
          No results found for "{rawQ}".
        </Panel>
      )}

      {customers.length > 0 && (
        <Panel className="overflow-hidden">
          <div className="border-b border-border bg-muted/30 px-6 py-4">
            <h3 className="flex items-center gap-2 font-semibold">
              <Users className="size-4 text-primary" />
              Customers ({customers.length})
            </h3>
          </div>
          <div className="divide-y divide-border">
            {customers.map((c) => (
              <Link
                key={c.id}
                to="/customers"
                className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-muted/50"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{c.name}</p>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatPhone(c.phone)} {c.email ? `• ${c.email}` : ""}
                  </p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </Panel>
      )}

      {workers.length > 0 && (
        <Panel className="overflow-hidden">
          <div className="border-b border-border bg-muted/30 px-6 py-4">
            <h3 className="flex items-center gap-2 font-semibold">
              <Wrench className="size-4 text-teal" />
              Workers ({workers.length})
            </h3>
          </div>
          <div className="divide-y divide-border">
            {workers.map((w) => (
              <Link
                key={w.id}
                to="/workers"
                className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-muted/50"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{w.name}</p>
                    <StatusBadge status={w.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatPhone(w.phone)} {w.email ? `• ${w.email}` : ""}
                  </p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
