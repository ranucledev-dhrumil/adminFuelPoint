import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[28px]">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  hint,
  tone = "primary",
  to,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  delta?: number;
  hint?: string;
  tone?: "primary" | "teal" | "navy" | "warning";
  to?: string;
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    teal: "bg-teal/10 text-teal",
    navy: "bg-navy/8 text-navy",
    warning: "bg-warning/15 text-warning",
  } as const;

  const content = (
    <div
      className={cn(
        "surface-card flex min-h-[136px] h-full flex-col justify-between p-5 transition-all duration-200 hover:shadow-elevated",
        to && "cursor-pointer hover:border-primary/40 hover:bg-muted/30"
      )}
    >
      <div>
        <div className="flex min-h-9 items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          {Icon ? (
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-border/50",
                tones[tone],
              )}
            >
              <Icon className="size-[18px]" />
            </span>
          ) : (
            <span className="size-9 shrink-0" />
          )}
        </div>
        <p className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-[28px]">
          {value}
        </p>
      </div>
      
      <div
        className={cn(
          "mt-3 flex min-h-[28px] flex-wrap items-center gap-2 border-t pt-2 text-xs",
          (delta !== undefined || hint) ? "border-border/40" : "border-transparent"
        )}
      >
        {(delta !== undefined || hint) && (
          <>
            {delta !== undefined && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold",
                  delta >= 0 ? "bg-success/12 text-success" : "bg-destructive/12 text-destructive",
                )}
              >
                {delta >= 0 ? (
                  <ArrowUpRight className="size-3" />
                ) : (
                  <ArrowDownRight className="size-3" />
                )}
                {Math.abs(delta).toFixed(1)}%
              </span>
            )}
            {hint && <span className="text-muted-foreground">{hint}</span>}
          </>
        )}
      </div>
    </div>
  );

  if (to) {
    return (
      <Link
        to={to as any}
        className="block h-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
      >
        {content}
      </Link>
    );
  }

  return content;
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface-card flex flex-col overflow-hidden", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
            {title}
          </h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="flex-1 p-5">{children}</div>
    </section>
  );
}

const statusTones: Record<string, string> = {
  active: "bg-success/12 text-success",
  inactive: "bg-muted text-muted-foreground",
  pending: "bg-warning/18 text-warning",
  offline: "bg-muted text-muted-foreground",
  suspended: "bg-destructive/12 text-destructive",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
        statusTones[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

export function GroupPill({ name, percent }: { name: string; percent: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
      {name}
      <span className="rounded-full bg-primary/12 px-1.5 text-[11px] font-semibold text-primary">
        {percent}%
      </span>
    </span>
  );
}

export function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-muted-foreground">
        {message}
      </td>
    </tr>
  );
}
