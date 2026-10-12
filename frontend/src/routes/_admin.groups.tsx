import { createFileRoute } from "@tanstack/react-router";
import { BadgePercent, Pencil, Plus, Power, Tags, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DonutChart, HorizontalBarChart } from "@/components/admin/charts";
import { PageHeader, Panel, StatCard } from "@/components/admin/primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAdmin } from "@/lib/admin-store";
import {
  DEFAULT_GROUP_ID,
  formatCurrency,
  formatDate,
  formatNumber,
  groupDistribution,
} from "@/services/adminService";
import type { Group } from "@/services/types";

export const Route = createFileRoute("/_admin/groups")({
  head: () => ({
    meta: [
      { title: "Groups & Discounts — FuelPoint Admin" },
      {
        name: "description",
        content:
          "Create discount groups, set percentages and assign customers to Family, Friends, Employees and more.",
      },
      { property: "og:title", content: "Groups & Discounts — FuelPoint Admin" },
      {
        property: "og:description",
        content: "Manage dynamic discount groups and customer assignments.",
      },
    ],
  }),
  component: GroupsPage,
});

const blank = { id: "", name: "", discountPercent: 1, description: "", active: true };

function GroupsPage() {
  const {
    groups,
    customers,
    transactions,
    saveGroup,
    deleteGroup,
    toggleGroupActive,
    assignCustomerGroup,
  } = useAdmin();
  const [editing, setEditing] = useState<typeof blank | null>(null);
  const [assignTarget, setAssignTarget] = useState<Group | null>(null);
  const [assignCustomer, setAssignCustomer] = useState("");

  const stats = useMemo(
    () => groupDistribution(customers, groups, transactions),
    [customers, groups, transactions],
  );
  const totalDiscount = stats.reduce((s, g) => s + g.discountGenerated, 0);

  const submit = () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast.error("Group name is required.");
      return;
    }
    const id = editing.id || `grp-${editing.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    saveGroup({ ...editing, id, discountPercent: Number(editing.discountPercent) || 0 });
    toast.success(editing.id ? "Group updated" : "Group created", { description: editing.name });
    setEditing(null);
  };

  return (
    <>
      <PageHeader
        title="Groups"
        subtitle="Define discount groups and control the percentage applied at scan time."
        actions={
          <Button onClick={() => setEditing({ ...blank })}>
            <Plus className="size-4" /> New group
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total groups" value={formatNumber(groups.length)} icon={Tags} />
        <StatCard
          label="Active groups"
          value={formatNumber(groups.filter((g) => g.active).length)}
          icon={Power}
          tone="teal"
        />
        <StatCard
          label="Grouped customers"
          value={formatNumber(customers.filter((c) => c.groupId !== DEFAULT_GROUP_ID).length)}
          icon={Users}
          tone="navy"
        />
        <StatCard
          label="Discount generated"
          value={formatCurrency(totalDiscount)}
          icon={BadgePercent}
          tone="teal"
        />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {stats.map((g) => {
          const group = groups.find((x) => x.id === g.id)!;
          return (
            <div
              key={g.id}
              className="surface-card flex flex-col justify-between p-5 transition-all duration-200 hover:shadow-elevated"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-foreground">{g.name}</h3>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      {g.discountPercent}% discount
                    </span>
                    {!g.active && (
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                    {group.description || "No description provided."}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Created {formatDate(group.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => setAssignTarget(group)}>
                    Assign customers
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Edit group"
                    title="Edit group"
                    onClick={() =>
                      setEditing({
                        id: group.id,
                        name: group.name,
                        discountPercent: group.discountPercent,
                        description: group.description,
                        active: group.active,
                      })
                    }
                  >
                    <Pencil className="size-4" />
                  </Button>
                  {!group.isDefault && (
                    <>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Toggle active"
                        title={group.active ? "Deactivate group" : "Activate group"}
                        onClick={() => toggleGroupActive(group.id)}
                      >
                        <Power className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Delete group"
                        title="Delete group"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => {
                          deleteGroup(group.id);
                          toast.success("Group deleted", {
                            description: `${group.name} customers moved to Default / Unassigned.`,
                          });
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 sm:gap-4">
                {[
                  ["Customers", formatNumber(g.customers)],
                  ["Transactions", formatNumber(g.transactions)],
                  ["Discount generated", formatCurrency(g.discountGenerated)],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-lg bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">{l}</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / edit */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>{editing.id ? "Edit group" : "Create discount group"}</DialogTitle>
                <DialogDescription>
                  The discount percentage applies automatically to every scan for this group.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="g-name">Group name</Label>
                  <Input
                    id="g-name"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="e.g. Neighbours"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="g-pct">Discount percentage</Label>
                  <Input
                    id="g-pct"
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={editing.discountPercent}
                    onChange={(e) =>
                      setEditing({ ...editing, discountPercent: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="g-desc">Description</Label>
                  <Textarea
                    id="g-desc"
                    value={editing.description}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                    placeholder="Who belongs in this group?"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button onClick={submit}>{editing.id ? "Save changes" : "Create group"}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign customers */}
      <Dialog open={!!assignTarget} onOpenChange={(o) => !o && setAssignTarget(null)}>
        <DialogContent className="sm:max-w-md">
          {assignTarget && (
            <>
              <DialogHeader>
                <DialogTitle>Assign customer to {assignTarget.name}</DialogTitle>
                <DialogDescription>
                  Unassigned customers are listed first — they are waiting for a group.
                </DialogDescription>
              </DialogHeader>
              <Select value={assignCustomer} onValueChange={setAssignCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {[...customers]
                    .filter((c) => c.groupId !== assignTarget.id)
                    .sort((a, b) =>
                      a.groupId === DEFAULT_GROUP_ID ? -1 : b.groupId === DEFAULT_GROUP_ID ? 1 : 0,
                    )
                    .slice(0, 60)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} · {c.phone}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAssignTarget(null)}>
                  Cancel
                </Button>
                <Button
                  disabled={!assignCustomer}
                  onClick={() => {
                    assignCustomerGroup(assignCustomer, assignTarget.id);
                    toast.success("Customer assigned", { description: assignTarget.name });
                    setAssignCustomer("");
                    setAssignTarget(null);
                  }}
                >
                  Assign
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
