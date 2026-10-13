import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Power, Tags, Trash2, Users, UsersRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, StatCard } from "@/components/admin/primitives";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  DEFAULT_GROUP_ID,
  customersApi,
  formatDate,
  formatNumber,
  formatPhone,
  groupsApi,
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

interface GroupFormData {
  id: string;
  name: string;
  discountPercent: number;
  description: string;
  active: boolean;
}

const blankGroup: GroupFormData = {
  id: "",
  name: "",
  discountPercent: 1,
  description: "",
  active: true,
};

function GroupsPage() {
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState<GroupFormData | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<Group | null>(null);
  const [assignTarget, setAssignTarget] = useState<Group | null>(null);
  const [assignCustomer, setAssignCustomer] = useState("");

  // Query groups list
  const {
    data: groups = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["admin", "groups"],
    queryFn: groupsApi.list,
  });

  // Query customers for assign modal
  const { data: customerList } = useQuery({
    queryKey: ["admin", "customers", "for-assign"],
    queryFn: () => customersApi.list({ limit: 100 }),
    enabled: Boolean(assignTarget),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: groupsApi.create,
    onSuccess: (newGroup) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "groups"] });
      toast.success("Group created", { description: newGroup.name });
      setEditing(null);
    },
    onError: (err: Error) => {
      toast.error("Failed to create group", { description: err.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        name?: string | undefined;
        discountPercent?: number | undefined;
        description?: string | null | undefined;
      };
    }) => groupsApi.update(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "groups"] });
      toast.success("Group updated", { description: updated.name });
      setEditing(null);
    },
    onError: (err: Error) => {
      toast.error("Failed to update group", { description: err.message });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: groupsApi.toggleActive,
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "groups"] });
      toast.success(updated.active ? "Group activated" : "Group deactivated", {
        description: updated.name,
      });
    },
    onError: (err: Error) => {
      toast.error("Failed to toggle group status", { description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => groupsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "groups"] });
      toast.success("Group deleted", {
        description: "Customers moved to Default / Unassigned.",
      });
      setDeletingGroup(null);
    },
    onError: (err: Error) => {
      toast.error("Failed to delete group", { description: err.message });
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ customerId, groupId }: { customerId: string; groupId: string }) =>
      customersApi.assignGroup(customerId, groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "groups"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
      toast.success("Customer assigned", { description: assignTarget?.name });
      setAssignCustomer("");
      setAssignTarget(null);
    },
    onError: (err: Error) => {
      toast.error("Failed to assign customer", { description: err.message });
    },
  });

  const submit = () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast.error("Group name is required.");
      return;
    }

    const discountPercent = Number(editing.discountPercent) || 0;
    if (discountPercent < 0 || discountPercent > 100) {
      toast.error("Discount percentage must be between 0 and 100.");
      return;
    }

    if (editing.id) {
      updateMutation.mutate({
        id: editing.id,
        data: {
          name: editing.name.trim(),
          discountPercent,
          description: editing.description.trim() || null,
        },
      });
    } else {
      createMutation.mutate({
        name: editing.name.trim(),
        discountPercent,
        description: editing.description.trim() || null,
        active: editing.active,
      });
    }
  };

  const totalGroups = groups.length;
  const activeGroups = groups.filter((g) => g.active).length;
  const groupedCustomers = groups
    .filter((g) => !g.isDefault && g.id !== DEFAULT_GROUP_ID)
    .reduce((s, g) => s + (g.customerCount ?? 0), 0);
  const unassignedCustomers =
    groups.find((g) => g.isDefault || g.id === DEFAULT_GROUP_ID)?.customerCount ?? 0;

  return (
    <>
      <PageHeader
        title="Groups"
        subtitle="Define discount groups and control the percentage applied at scan time."
        actions={
          <Button onClick={() => setEditing({ ...blankGroup })}>
            <Plus className="size-4" /> New group
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total groups" value={formatNumber(totalGroups)} icon={Tags} />
        <StatCard
          label="Active groups"
          value={formatNumber(activeGroups)}
          icon={Power}
          tone="teal"
        />
        <StatCard
          label="Grouped customers"
          value={formatNumber(groupedCustomers)}
          icon={Users}
          tone="navy"
        />
        <StatCard
          label="Default / Unassigned"
          value={formatNumber(unassignedCustomers)}
          icon={UsersRound}
          tone="teal"
        />
      </div>

      {isLoading && (
        <div className="mt-12 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin text-primary" />
          <span>Loading discount groups…</span>
        </div>
      )}

      {isError && (
        <div className="mt-8 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-center text-sm text-destructive">
          Failed to load groups from server. Please try refreshing.
        </div>
      )}

      {!isLoading && !isError && (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {groups.map((group) => {
            const isDef = group.isDefault || group.id === DEFAULT_GROUP_ID;
            return (
              <div
                key={group.id}
                className="surface-card flex flex-col justify-between p-5 transition-all duration-200 hover:shadow-elevated"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground">{group.name}</h3>
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                        {group.discountPercent}% discount
                      </span>
                      {isDef && (
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                          Default
                        </span>
                      )}
                      {!group.active && (
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
                          description: group.description || "",
                          active: group.active,
                        })
                      }
                    >
                      <Pencil className="size-4" />
                    </Button>
                    {!isDef && (
                      <>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Toggle active"
                          title={group.active ? "Deactivate group" : "Activate group"}
                          onClick={() => toggleActiveMutation.mutate(group.id)}
                          disabled={toggleActiveMutation.isPending}
                        >
                          <Power className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Delete group"
                          title="Delete group"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeletingGroup(group)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Customers</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {formatNumber(group.customerCount ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Discount percentage</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {group.discountPercent}%
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
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
                  <Label htmlFor="g-pct">Discount percentage (0–100%)</Label>
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
                <Button
                  onClick={submit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" /> Saving…
                    </>
                  ) : editing.id ? (
                    "Save changes"
                  ) : (
                    "Create group"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Group Confirmation */}
      <AlertDialog open={!!deletingGroup} onOpenChange={(o) => !o && setDeletingGroup(null)}>
        <AlertDialogContent>
          {deletingGroup && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {deletingGroup.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. All customers currently in {deletingGroup.name} will
                  be moved to the Default / Unassigned group.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deleteMutation.mutate(deletingGroup.id)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" /> Deleting…
                    </>
                  ) : (
                    "Delete group"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign customers Dialog */}
      <Dialog open={!!assignTarget} onOpenChange={(o) => !o && setAssignTarget(null)}>
        <DialogContent className="sm:max-w-md">
          {assignTarget && (
            <>
              <DialogHeader>
                <DialogTitle>Assign customer to {assignTarget.name}</DialogTitle>
                <DialogDescription>
                  Select a customer to reassign their discount group to {assignTarget.name} (
                  {assignTarget.discountPercent}%).
                </DialogDescription>
              </DialogHeader>
              <Select value={assignCustomer} onValueChange={setAssignCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {(customerList?.data ?? [])
                    .filter((c) => c.groupId !== assignTarget.id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} · {formatPhone(c.phone)} ({c.groupName || "Unassigned"})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAssignTarget(null)}>
                  Cancel
                </Button>
                <Button
                  disabled={!assignCustomer || assignMutation.isPending}
                  onClick={() => {
                    assignMutation.mutate({
                      customerId: assignCustomer,
                      groupId: assignTarget.id,
                    });
                  }}
                >
                  {assignMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" /> Assigning…
                    </>
                  ) : (
                    "Assign"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
