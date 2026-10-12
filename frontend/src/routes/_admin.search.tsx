import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, Wrench, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { PageHeader, Panel, StatusBadge } from "@/components/admin/primitives";
import { adminService, formatDate } from "@/services/adminService";

export const Route = createFileRoute("/_admin/search")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      q: (search.q as string) || "",
    };
  },
  component: SearchResultsPage,
});

function SearchResultsPage() {
  const { q } = Route.useSearch();
  const rawQ = q.trim().toLowerCase();

  const customers = useMemo(() => adminService.getCustomers(), []);
  const workers = useMemo(() => adminService.getWorkers(), []);

  const filteredCustomers = useMemo(() => {
    if (!rawQ) return [];
    return customers.filter(
      (c) =>
        c.name?.toLowerCase().includes(rawQ) ||
        c.phone?.toLowerCase().includes(rawQ) ||
        c.email?.toLowerCase().includes(rawQ)
    );
  }, [customers, rawQ]);

  const filteredWorkers = useMemo(() => {
    if (!rawQ) return [];
    return workers.filter(
      (w) =>
        w.name?.toLowerCase().includes(rawQ) ||
        w.phone?.toLowerCase().includes(rawQ) ||
        w.email?.toLowerCase().includes(rawQ)
    );
  }, [workers, rawQ]);

  if (!rawQ) {
    return (
      <div className="space-y-6">
        <PageHeader title="Search" description="Enter a query to search across customers and workers." />
        <Panel className="p-12 text-center text-muted-foreground">
          Type in the top bar to begin searching.
        </Panel>
      </div>
    );
  }

  const hasResults = filteredCustomers.length > 0 || filteredWorkers.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Search Results"
        description={`Showing results for "${q}"`}
      />

      {!hasResults && (
        <Panel className="p-12 text-center text-muted-foreground">
          No results found for "{q}".
        </Panel>
      )}

      {filteredCustomers.length > 0 && (
        <Panel className="overflow-hidden">
          <div className="border-b border-border bg-muted/30 px-6 py-4">
            <h3 className="flex items-center gap-2 font-semibold">
              <Users className="size-4 text-primary" />
              Customers ({filteredCustomers.length})
            </h3>
          </div>
          <div className="divide-y divide-border">
            {filteredCustomers.map((c) => (
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
                    {c.phone} • {c.email}
                  </p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </Panel>
      )}

      {filteredWorkers.length > 0 && (
        <Panel className="overflow-hidden">
          <div className="border-b border-border bg-muted/30 px-6 py-4">
            <h3 className="flex items-center gap-2 font-semibold">
              <Wrench className="size-4 text-teal" />
              Workers ({filteredWorkers.length})
            </h3>
          </div>
          <div className="divide-y divide-border">
            {filteredWorkers.map((w) => (
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
                    {w.phone} • {w.email}
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
