import { ChevronLeft, ChevronRight, ChevronsUpDown, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  align?: "left" | "right";
  className?: string;
}

export interface ServerPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: ((size: number) => void) | undefined;
  sortKey?: string | undefined;
  sortDir?: "asc" | "desc" | undefined;
  onSortChange?: ((key: string, dir: "asc" | "desc") => void) | undefined;
}

export function TablePagination({
  currentPage,
  totalPages,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  totalItems,
  currentCount,
  onPageChange,
  onPageSizeChange,
  className,
}: {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  pageSizeOptions?: number[] | undefined;
  totalItems: number;
  currentCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: ((size: number) => void) | undefined;
  className?: string | undefined;
}) {
  const safePage = Math.max(1, Math.min(currentPage, Math.max(1, totalPages)));
  const from = currentCount > 0 ? (safePage - 1) * pageSize + 1 : 0;
  const to = (safePage - 1) * pageSize + currentCount;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-border px-1 pt-4 text-sm",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <p className="text-xs text-muted-foreground">
          Showing {from}–{to} of {totalItems}
        </p>
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-muted-foreground">Rows per page</p>
            <Select
              value={pageSize.toString()}
              onValueChange={(val) => onPageSizeChange(Number(val))}
            >
              <SelectTrigger className="h-7 w-[60px] text-xs px-2 cursor-pointer">
                <SelectValue placeholder={pageSize} />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={size.toString()} className="text-xs cursor-pointer">
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage <= 1}
          className="cursor-pointer inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="size-3.5" /> Prev
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          const start = Math.max(1, Math.min(safePage - 2, totalPages - 4));
          const num = totalPages <= 5 ? i + 1 : start + i;
          return (
            <button
              key={num}
              type="button"
              onClick={() => onPageChange(num)}
              className={cn(
                "cursor-pointer size-8 rounded-md border text-xs font-medium transition-colors",
                num === safePage
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-muted",
              )}
            >
              {num}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage >= totalPages}
          className="cursor-pointer inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  pageSize = 10,
  emptyMessage = "No records match the current filters.",
  onRowClick,
  serverPagination,
  isLoading,
}: {
  rows: T[];
  columns: Column<T>[];
  pageSize?: number | undefined;
  emptyMessage?: string | undefined;
  onRowClick?: ((row: T) => void) | undefined;
  serverPagination?: ServerPaginationProps | undefined;
  isLoading?: boolean | undefined;
}) {
  const [clientSort, setClientSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [clientPage, setClientPage] = useState(1);
  const [actualPageSize, setActualPageSize] = useState(pageSize);

  useEffect(() => {
    if (!serverPagination) {
      setClientPage(1);
    }
  }, [rows.length, clientSort, actualPageSize, serverPagination]);

  const isServer = Boolean(serverPagination);

  const sorted = useMemo(() => {
    if (isServer || !clientSort) return rows;
    const col = columns.find((c) => c.key === clientSort.key);
    if (!col?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      const res =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return clientSort.dir === "asc" ? res : -res;
    });
  }, [rows, clientSort, columns, isServer]);

  const totalPages = isServer
    ? serverPagination!.totalPages
    : Math.max(1, Math.ceil(sorted.length / actualPageSize));
  const safePage = isServer ? serverPagination!.currentPage : Math.min(clientPage, totalPages);
  const slice = isServer
    ? rows
    : sorted.slice((safePage - 1) * actualPageSize, safePage * actualPageSize);

  const currentSortKey = isServer ? serverPagination?.sortKey : clientSort?.key;

  const toggleSort = (key: string) => {
    if (isServer && serverPagination?.onSortChange) {
      const nextDir =
        serverPagination.sortKey === key && serverPagination.sortDir === "asc" ? "desc" : "asc";
      serverPagination.onSortChange(key, nextDir);
      return;
    }

    setClientSort((prev) =>
      prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" },
    );
  };

  return (
    <div className="relative">
      <div className={cn("overflow-x-auto", isLoading && "opacity-60 transition-opacity")}>
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase",
                    col.align === "right" && "text-right",
                  )}
                >
                  {col.sortValue || (isServer && serverPagination?.onSortChange) ? (
                    <button
                      onClick={() => toggleSort(col.key)}
                      className={cn(
                        "inline-flex items-center gap-1 cursor-pointer transition-colors hover:text-foreground",
                        currentSortKey === col.key && "text-primary font-bold",
                      )}
                    >
                      {col.header}
                      <ChevronsUpDown className="size-3" />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="size-4 animate-spin text-primary" />
                      <span>Loading records…</span>
                    </div>
                  ) : (
                    emptyMessage
                  )}
                </td>
              </tr>
            )}
            {slice.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  "border-b border-border/70 last:border-0",
                  onRowClick && "cursor-pointer transition-colors hover:bg-accent/60",
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-4 py-3 align-middle text-foreground",
                      col.align === "right" && "text-right",
                      col.className,
                    )}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TablePagination
        currentPage={safePage}
        totalPages={totalPages}
        pageSize={isServer ? serverPagination!.pageSize : actualPageSize}
        pageSizeOptions={Array.from(
          new Set([isServer ? serverPagination!.pageSize : pageSize, 10, 25, 50, 100]),
        ).sort((a, b) => a - b)}
        totalItems={isServer ? serverPagination!.totalItems : sorted.length}
        currentCount={slice.length}
        onPageChange={isServer ? serverPagination!.onPageChange : setClientPage}
        onPageSizeChange={isServer ? serverPagination!.onPageSizeChange : setActualPageSize}
      />
    </div>
  );
}
