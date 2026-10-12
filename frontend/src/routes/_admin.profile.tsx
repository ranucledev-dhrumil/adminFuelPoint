import { createFileRoute } from "@tanstack/react-router";
import { Camera, KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/admin/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAdmin } from "@/lib/admin-store";
import { formatDate } from "@/services/adminService";

export const Route = createFileRoute("/_admin/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — FuelPoint Admin" },
      {
        name: "description",
        content: "Manage your admin account details, contact information and password.",
      },
      { property: "og:title", content: "My Profile — FuelPoint Admin" },
      {
        property: "og:description",
        content: "Admin account details, contact information and password settings.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, updateProfile } = useAdmin();
  const [form, setForm] = useState({
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    location: profile.location,
  });
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });

  const save = () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required.");
      return;
    }
    updateProfile({ ...form, initials: form.name.split(" ").map((n) => n[0]).join("").slice(0, 2) });
    toast.success("Profile updated");
  };

  const changePassword = () => {
    if (pw.next.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (pw.next !== pw.confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setPw({ current: "", next: "", confirm: "" });
    toast.success("Password changed");
  };

  return (
    <>
      <PageHeader title="My Profile" subtitle="Your administrator account and security settings." />

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="surface-card p-4 text-center">
          <div className="relative mx-auto w-fit">
            <div className="gradient-brand flex size-20 items-center justify-center rounded-full text-2xl font-bold text-primary-foreground">
              {profile.initials}
            </div>
            <button
              onClick={() => toast.info("Avatar upload will connect to storage later.")}
              className="absolute right-0 bottom-0 flex size-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:text-foreground"
              aria-label="Change avatar"
            >
              <Camera className="size-4" />
            </button>
          </div>
          <h2 className="mt-3 text-lg font-semibold text-foreground">{profile.name}</h2>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <ShieldCheck className="size-3.5" /> {profile.role}
          </span>

          <Separator className="my-3" />
          <dl className="space-y-3 text-left text-sm">
            {[
              ["Phone", profile.phone],
              ["Location", profile.location],
              ["Admin since", formatDate(profile.joinedAt)],
            ].map(([l, v]) => (
              <div key={l} className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{l}</dt>
                <dd className="text-right font-medium text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="lg:col-span-2">
          <Panel title="Account & Security" description="Manage your admin details and password">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="p-name">Full name</Label>
                <Input id="p-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-email">Email address</Label>
                <Input
                  id="p-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-phone">Phone</Label>
                <Input id="p-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-loc">Location</Label>
                <Input
                  id="p-loc"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
            </div>
            
            <Separator className="my-4" />
            
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="pw-c">Current password</Label>
                <Input
                  id="pw-c"
                  type="password"
                  placeholder="Current password"
                  value={pw.current}
                  onChange={(e) => setPw({ ...pw, current: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw-n">New password</Label>
                <Input
                  id="pw-n"
                  type="password"
                  placeholder="New password"
                  value={pw.next}
                  onChange={(e) => setPw({ ...pw, next: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw-r">Confirm password</Label>
                <Input
                  id="pw-r"
                  type="password"
                  placeholder="Confirm password"
                  value={pw.confirm}
                  onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                />
              </div>
            </div>
            
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  setForm({
                    name: profile.name,
                    email: profile.email,
                    phone: profile.phone,
                    location: profile.location,
                  })
                }
              >
                Reset
              </Button>
              <Button onClick={() => { save(); if (pw.next) changePassword(); }}>
                <KeyRound className="size-4" /> Save all changes
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
