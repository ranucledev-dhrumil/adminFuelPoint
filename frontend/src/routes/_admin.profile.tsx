import { createFileRoute } from "@tanstack/react-router";
import { Camera, KeyRound, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/admin/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAdmin } from "@/lib/admin-store";
import { formatDate, formatPhone, profileApi } from "@/services/adminService";

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
  const queryClient = useQueryClient();
  const { setProfile: setStoreProfile } = useAdmin();

  const profileQuery = useQuery({
    queryKey: ["admin", "profile"],
    queryFn: () => profileApi.get(),
  });

  const profile = profileQuery.data ?? {
    name: "Administrator",
    email: "admin@fuelpoint.local",
    phone: "",
    role: "admin",
    location: "Main Station",
    joinedAt: new Date().toISOString(),
    initials: "AD",
    avatarUrl: null,
  };

  const [form, setForm] = useState({
    name: profile.name,
    phone: profile.phone,
    location: profile.location,
  });

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });

  // Sync form state when profile data loads
  useEffect(() => {
    if (profileQuery.data) {
      setForm({
        name: profileQuery.data.name,
        phone: profileQuery.data.phone || "",
        location: profileQuery.data.location || "",
      });
      setStoreProfile(profileQuery.data);
    }
  }, [profileQuery.data, setStoreProfile]);

  const updateProfileMutation = useMutation({
    mutationFn: (data: { name: string; phone?: string | null; location?: string | null }) =>
      profileApi.update(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(["admin", "profile"], updated);
      setStoreProfile(updated);
      toast.success("Profile updated successfully");
    },
    onError: (err: Error) => {
      toast.error("Failed to update profile", { description: err.message });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      profileApi.changePassword(data),
    onSuccess: () => {
      setPw({ current: "", next: "", confirm: "" });
      toast.success("Password changed successfully");
    },
    onError: (err: Error) => {
      toast.error("Failed to change password", { description: err.message });
    },
  });

  const handleSaveProfile = () => {
    if (!form.name.trim()) {
      toast.error("Name cannot be empty.");
      return;
    }
    updateProfileMutation.mutate({
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      location: form.location.trim() || null,
    });
  };

  const handleChangePassword = () => {
    if (!pw.current) {
      toast.error("Please enter your current password.");
      return;
    }
    if (pw.next.length < 8) {
      toast.error("New password must be at least 8 characters long.");
      return;
    }
    if (pw.next !== pw.confirm) {
      toast.error("New passwords do not match.");
      return;
    }
    changePasswordMutation.mutate({
      currentPassword: pw.current,
      newPassword: pw.next,
    });
  };

  return (
    <>
      <PageHeader title="My Profile" subtitle="Your administrator account and security settings." />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <div className="surface-card p-6 text-center">
          <div className="relative mx-auto w-fit">
            <div className="gradient-brand flex size-20 items-center justify-center rounded-full text-2xl font-bold text-primary-foreground shadow-sm">
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
          <h2 className="mt-4 text-lg font-semibold text-foreground">{profile.name}</h2>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary capitalize">
            <ShieldCheck className="size-3.5" /> {profile.role}
          </span>

          <Separator className="my-5" />
          <dl className="space-y-3 text-left text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="text-right font-medium text-foreground">
                {profile.phone ? formatPhone(profile.phone) : "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Location</dt>
              <dd className="text-right font-medium text-foreground">{profile.location || "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Admin since</dt>
              <dd className="text-right font-medium text-foreground">
                {formatDate(profile.joinedAt)}
              </dd>
            </div>
          </dl>
        </div>

        {/* Profile & Security Forms */}
        <div className="lg:col-span-2 space-y-6">
          <Panel
            title="Personal Information"
            description="Update your name, contact phone and location"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="p-name">Full name</Label>
                <Input
                  id="p-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-email">Email address</Label>
                <Input
                  id="p-email"
                  type="email"
                  value={profile.email}
                  disabled
                  className="bg-muted cursor-not-allowed opacity-80"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-phone">Phone number</Label>
                <Input
                  id="p-phone"
                  placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-loc">Location</Label>
                <Input
                  id="p-loc"
                  placeholder="e.g. Pump Station 1, Mumbai"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  setForm({
                    name: profile.name,
                    phone: profile.phone || "",
                    location: profile.location || "",
                  })
                }
              >
                Reset
              </Button>
              <Button disabled={updateProfileMutation.isPending} onClick={handleSaveProfile}>
                {updateProfileMutation.isPending ? "Saving…" : "Save Information"}
              </Button>
            </div>
          </Panel>

          <Panel
            title="Security & Password"
            description="Ensure your account uses a secure password"
          >
            <div className="grid gap-4 sm:grid-cols-3">
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
                  placeholder="Min 8 characters"
                  value={pw.next}
                  onChange={(e) => setPw({ ...pw, next: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw-r">Confirm new password</Label>
                <Input
                  id="pw-r"
                  type="password"
                  placeholder="Confirm password"
                  value={pw.confirm}
                  onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <Button disabled={changePasswordMutation.isPending} onClick={handleChangePassword}>
                <KeyRound className="size-4" />
                {changePasswordMutation.isPending ? "Changing…" : "Change Password"}
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
