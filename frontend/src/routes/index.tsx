import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Fuel, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAdmin } from "@/lib/admin-store";
import { authApi } from "@/lib/api-client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Admin Sign In — FuelPoint Console" },
      {
        name: "description",
        content:
          "Secure sign in for petrol pump administrators managing customers, workers and discount groups.",
      },
      { property: "og:title", content: "Admin Sign In — FuelPoint Console" },
      {
        property: "og:description",
        content: "Secure sign in for the FuelPoint petrol pump admin console.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login, authed, authReady } = useAdmin();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@fuelpoint.local");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    if (authReady && authed) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [authReady, authed, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Please enter both email and password.");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      toast.success("Signed in successfully");
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to sign in. Please verify your credentials.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail.trim()) {
      toast.error("Please enter your admin email address.");
      return;
    }
    setForgotLoading(true);
    try {
      const res = await authApi.forgotPassword(resetEmail.trim());
      setForgot(false);
      setResetEmail("");
      toast.success("Password reset link sent", {
        description:
          res.message || "If the email is registered, a password reset link has been sent.",
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to send reset link. Please try again.";
      toast.error(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="gradient-navy relative hidden flex-col justify-between p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
            <Fuel className="size-5" />
          </span>
          <div>
            <p className="font-semibold">FuelPoint</p>
            <p className="text-xs text-white/60">Petrol pump management suite</p>
          </div>
        </div>

        <div className="max-w-md">
          <h1 className="text-4xl leading-tight font-bold">
            One console for customers, workers and discounts.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            Assign customers to discount groups, monitor worker scanning activity and track every
            rupee of discount given — in real time.
          </p>
          <dl className="mt-10 grid grid-cols-3 gap-4">
            {[
              ["96", "Customers"],
              ["10", "Workers"],
              ["5", "Active groups"],
            ].map(([v, l]) => (
              <div key={l} className="rounded-xl bg-white/6 p-4 ring-1 ring-white/10">
                <dt className="text-2xl font-bold">{v}</dt>
                <dd className="text-xs text-white/60">{l}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="flex items-center gap-2 text-xs text-white/50">
          <ShieldCheck className="size-4" /> Encrypted session · Role-restricted admin access
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-background px-5 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="gradient-brand flex size-10 items-center justify-center rounded-xl text-primary-foreground">
              <Fuel className="size-5" />
            </span>
            <p className="font-semibold text-foreground">FuelPoint Admin</p>
          </div>

          <h2 className="text-2xl font-bold text-foreground">Admin sign in</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Use your administrator credentials to continue.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  placeholder="admin@fuelpoint.in"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={() => setForgot(true)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={remember}
                onCheckedChange={(v) => setRemember(Boolean(v))}
                aria-label="Remember me"
              />
              Remember me on this device
            </label>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Signing in…
                </>
              ) : (
                <>
                  Sign in to console <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 rounded-lg border border-border bg-card px-3 py-2.5 text-xs text-muted-foreground">
            Enter your Super Admin credentials to sign in. Session uses secure in-memory access
            tokens and httpOnly refresh cookies.
          </p>
        </div>
      </div>

      <Dialog open={forgot} onOpenChange={setForgot}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
            <DialogDescription>
              We'll email a secure reset link to your registered admin address.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reset">Admin email</Label>
            <Input
              id="reset"
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="admin@fuelpoint.in"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForgot(false)}>
              Cancel
            </Button>
            <Button onClick={handleForgotPassword} disabled={forgotLoading}>
              {forgotLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Sending…
                </>
              ) : (
                "Send reset link"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
