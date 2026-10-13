import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Fuel, Loader2, Lock, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/api-client";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      token: (search["token"] as string) || "",
    };
  },
  head: () => ({
    meta: [
      { title: "Reset Password — FuelPoint Admin" },
      {
        name: "description",
        content: "Reset your administrator password for FuelPoint console.",
      },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!token) {
      setErrorMessage("Missing reset token. Please request a new password reset link.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("New password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.resetPassword(token, password);
      setIsSuccess(true);
      toast.success("Password reset successful", {
        description: res.message || "Your password has been reset. You may now log in.",
      });
      setTimeout(() => {
        navigate({ to: "/" });
      }, 3000);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to reset password. The link may have expired or already been used.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
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
          <h1 className="text-4xl leading-tight font-bold">Secure admin password recovery.</h1>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            Choose a strong password with at least 8 characters to secure your station's
            administration console.
          </p>
        </div>

        <p className="flex items-center gap-2 text-xs text-white/50">
          <ShieldCheck className="size-4" /> Single-use cryptographically signed token
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

          {!token ? (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">Invalid Reset Link</h2>
              <p className="text-sm text-muted-foreground">
                No password reset token was provided in the link. Please request a new password
                reset email.
              </p>
              <Button asChild className="w-full mt-4">
                <Link to="/">
                  <ArrowLeft className="mr-2 size-4" /> Back to Sign In
                </Link>
              </Button>
            </div>
          ) : isSuccess ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success/15 text-success">
                <CheckCircle2 className="size-6" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Password Reset</h2>
              <p className="text-sm text-muted-foreground">
                Your password has been successfully updated. Redirecting to sign in…
              </p>
              <Button asChild className="w-full mt-4">
                <Link to="/">Sign in now</Link>
              </Button>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-foreground">Create new password</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Enter and confirm your new password below.
              </p>

              {errorMessage && (
                <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <div className="relative">
                    <Lock className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="new-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Must be at least 8 characters long
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <div className="relative">
                    <Lock className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-9"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full mt-2" size="lg" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" /> Updating password…
                    </>
                  ) : (
                    "Reset password"
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  to="/"
                  className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="mr-1.5 size-3.5" /> Return to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
