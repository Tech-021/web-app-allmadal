"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness } from "@/app/components/business-context";
import { useToast } from "@/app/components/toast-context";
import { ActivityCategory, ActivityLog, clearAllLogs } from "@/app/lib/logger";
import { api } from "@/app/lib/api";
import ui from "@/app/components/workspace-ui.module.css";
import { Icon } from "@/app/components/icons";
import { PageHeader, TableEmptyRow, TableSkeletonRows } from "@/app/components/page-layout";
import { PaginationControls } from "@/app/components/pagination-controls";
import { useNavRole } from "@/hooks/useNavRole";
import { devLog, devWarn } from "@/app/lib/dev-console";
import { isAuthSessionMessage } from "@/app/lib/auth-session";

function isExpectedAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return isAuthSessionMessage(msg);
}

function parseLogsPayload(response: unknown): ActivityLog[] {
  if (Array.isArray(response)) return response as ActivityLog[];
  if (response && typeof response === "object") {
    const record = response as { logs?: unknown; data?: unknown };
    if (Array.isArray(record.logs)) return record.logs as ActivityLog[];
    if (Array.isArray(record.data)) return record.data as ActivityLog[];
  }
  return [];
}

function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatFullDate(dateString: string): string {
  const d = new Date(dateString);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function actionTone(action: string, category: ActivityCategory): "neg" | "pos" | "info" | "warn" | "neutral" {
  if (action.includes("DELETE")) return "neg";
  if (action.includes("CREATE") || action.includes("ADD") || action.includes("SIGNUP")) return "pos";
  if (action.includes("UPDATE") || action.includes("EDIT")) return "info";
  if (action.includes("LOGIN") || action.includes("LOGOUT") || category === "Auth" || category === "Visit") return "neutral";
  return "warn";
}

const TONE_CHIP = { neg: ui.chipNeg, pos: ui.chipPos, info: ui.chipInfo, warn: ui.chipWarn, neutral: "" } as const;

const LOG_TABS = [
  "All",
  "Product & Stock",
  "Customers & Suppliers",
  "Finance & Accounts",
  "Staff",
  "Auth & Sessions",
  "Page Visits",
] as const;

export default function LogsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { activeBusiness, isLoading: businessLoading } = useBusiness();
  const navRole = useNavRole();
  const router = useRouter();
  const { showToast, confirmDialog } = useToast();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<
    "All" | "Product & Stock" | "Customers & Suppliers" | "Finance & Accounts" | "Staff" | "Auth & Sessions" | "Page Visits"
  >("All");
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [serverNotice, setServerNotice] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadLogs = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setLogs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setServerNotice("");
    devLog("%c[Almadel Logs Dashboard] 📥 Starting to fetch activity logs...", "color: #0284c7; font-weight: bold");

    try {
      let serverLogs: ActivityLog[] = [];
      let isRouteFound = false;

      // 1. Fetch from GET /admin/logs
      try {
        devLog("%c[Almadel Logs Dashboard] 🔍 Attempt 1: Calling GET /admin/logs", "color: #6366f1; font-weight: 600");
        const response = await api<unknown>("/admin/logs");
        isRouteFound = true;
        serverLogs = parseLogsPayload(response);
        devLog("%c[Almadel Logs Dashboard] ✅ GET /admin/logs succeeded", "color: #16a34a; font-weight: bold");
      } catch (err: unknown) {
        if (isExpectedAuthError(err)) {
          devWarn("[Almadel Logs Dashboard] Skipping fetch — no active session.");
          setLogs([]);
          return;
        }
        devWarn("%c[Almadel Logs Dashboard] ⚠️ GET /admin/logs failed:", "color: #d97706; font-weight: bold", err);

        // 2. Fallback to GET /logs
        try {
          devLog("%c[Almadel Logs Dashboard] 🔍 Attempt 2: Calling fallback GET /logs", "color: #6366f1; font-weight: 600");
          const fallbackRes = await api<unknown>("/logs");
          isRouteFound = true;
          serverLogs = parseLogsPayload(fallbackRes);
          devLog("%c[Almadel Logs Dashboard] ✅ GET /logs succeeded", "color: #16a34a; font-weight: bold");
        } catch (err2: unknown) {
          if (isExpectedAuthError(err2)) {
            devWarn("[Almadel Logs Dashboard] Skipping fetch — no active session.");
            setLogs([]);
            return;
          }
          devWarn("%c[Almadel Logs Dashboard] ⚠️ GET /logs failed:", "color: #d97706; font-weight: bold", err2);
        }
      }

      // If remote server hasn't been restarted with the new logs module yet, load DB stock logs
      if (!isRouteFound) {
        setServerNotice("Note: The remote backend server (65.108.249.169) does not have the new /admin/logs route deployed/restarted yet. Showing database stock movement logs.");
        devLog("%c[Almadel Logs Dashboard] 🔍 Attempt 3: Loading database stock movement logs from /stock/logs...", "color: #0284c7; font-weight: 600");

        try {
          const stockData = await api<Array<{
            id?: string | number;
            created_at?: string;
            createdAt?: string;
            note?: string;
            notes?: string;
            quantity?: number;
            previousStock?: number;
            newStock?: number;
            product?: { name?: string; barcode?: string };
            user?: { fullName?: string; email?: string; name?: string };
          }>>("/stock/logs").catch(() => []);

          if (Array.isArray(stockData) && stockData.length > 0) {
            devLog(`%c[Almadel Logs Dashboard] ✅ Loaded ${stockData.length} stock logs from database.`, "color: #16a34a; font-weight: bold");
            const stockLogs: ActivityLog[] = stockData.map((item, idx) => ({
              id: String(item.id || idx),
              timestamp: item.createdAt || item.created_at || new Date().toISOString(),
              action: "STOCK_UPDATE",
              category: "Stock",
              user: {
                name: item.user?.fullName || item.user?.name || "Inventory Staff",
                email: item.user?.email || "staff@almadel.com",
                role: "staff",
              },
              details: item.note || item.notes || `Stock adjusted (Quantity: ${item.quantity ?? 0})`,
              target: item.product?.name || item.product?.barcode || "Stock",
            }));
            serverLogs = stockLogs;
          } else {
            devLog("%c[Almadel Logs Dashboard] ℹ️ /stock/logs returned 0 records.", "color: #64748b");
          }
        } catch (stockErr) {
          devWarn("%c[Almadel Logs Dashboard] ⚠️ Failed to fetch /stock/logs:", "color: #d97706; font-weight: bold", stockErr);
        }
      }

      devLog(`%c[Almadel Logs Dashboard] 📊 Total logs loaded into state: ${serverLogs.length}`, "color: #059669; font-weight: bold");
      setLogs(serverLogs);
    } catch (err) {
      if (!isExpectedAuthError(err)) {
        devWarn("%c[Almadel Logs Dashboard] ⚠️ Log load failed:", "color: #d97706; font-weight: bold", err);
      }
    } finally {
      setLoading(false);
    }
  }, [activeBusiness?.id, isAuthenticated, user]);

  useEffect(() => {
    if (authLoading || businessLoading) return;
    if (!isAuthenticated || !user) {
      setLoading(false);
      return;
    }
    if (navRole !== "admin") {
      showToast("Access restricted. Activity logs are available to store owners only.", "error");
      router.replace(navRole === "accountant" ? "/accounts" : "/sales");
      return;
    }
    void loadLogs();

    const handleLogAdded = () => {
      devLog("%c[Almadel Logs Dashboard] 🔔 almadel_log_added event received, refreshing logs...", "color: #6366f1; font-weight: 600");
      loadLogs();
    };
    const handleLogsCleared = () => {
      devLog("%c[Almadel Logs Dashboard] 🔔 almadel_logs_cleared event received, resetting state to []", "color: #e11d48; font-weight: 600");
      setLogs([]);
    };

    window.addEventListener("almadel_log_added", handleLogAdded);
    window.addEventListener("almadel_logs_cleared", handleLogsCleared);

    return () => {
      window.removeEventListener("almadel_log_added", handleLogAdded);
      window.removeEventListener("almadel_logs_cleared", handleLogsCleared);
    };
  }, [user, isAuthenticated, authLoading, navRole, businessLoading, router, showToast, loadLogs]);

  // Reset to first page when filtering or searching
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, query, pageSize]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Category filter
      if (activeTab === "Product & Stock") {
        if (log.category !== "Product" && log.category !== "Stock" && log.category !== "Category") return false;
      } else if (activeTab === "Customers & Suppliers") {
        if (log.category !== "Customer" && log.category !== "Supplier") return false;
      } else if (activeTab === "Finance & Accounts") {
        if (
          log.category !== "Finance" &&
          log.category !== "Expense" &&
          log.category !== "Account" &&
          log.category !== "Billing" &&
          log.category !== "Settings" &&
          log.category !== "Sales"
        )
          return false;
      } else if (activeTab === "Staff") {
        if (log.category !== "Staff") return false;
      } else if (activeTab === "Auth & Sessions") {
        if (log.category !== "Auth") return false;
      } else if (activeTab === "Page Visits") {
        if (log.category !== "Visit") return false;
      }

      // Search query filter
      if (query.trim()) {
        const q = query.toLowerCase();
        const matchUser =
          log.user.name.toLowerCase().includes(q) ||
          log.user.email.toLowerCase().includes(q);
        const matchAction = log.action.toLowerCase().includes(q);
        const matchDetails = log.details.toLowerCase().includes(q);
        const matchTarget = log.target?.toLowerCase().includes(q);
        return matchUser || matchAction || matchDetails || matchTarget;
      }

      return true;
    });
  }, [logs, activeTab, query]);

  // Pagination calculations
  const totalItems = filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedLogs = useMemo(() => {
    return filteredLogs.slice(startIndex, endIndex);
  }, [filteredLogs, startIndex, endIndex]);

  const handleClearAll = async () => {
    const confirmed = await confirmDialog({
      title: "Clear Database Audit Logs?",
      message: "Are you sure you want to permanently delete all activity logs from the database? This action cannot be undone.",
      confirmLabel: "Clear All Logs",
      danger: true,
    });
    if (confirmed) {
      await clearAllLogs();
      setLogs([]);
      showToast("All activity logs have been cleared from the database.", "success");
    }
  };

  return (
    <WorkspaceShell>
      <PageHeader
        eyebrow="Audit & security"
        title="Activity logs"
        description="A complete audit trail of product updates, stock movements, category edits and staff operations."
        actions={
          <>
            <button className={ui.secondary} onClick={loadLogs} disabled={loading}>
              <Icon name="refresh" size={14} className={loading ? "[animation:almadelSpin_800ms_linear_infinite]" : ""} />
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            <button className={ui.danger} onClick={handleClearAll} title="Clear database log records">
              <Icon name="trash" size={14} />
              Clear logs
            </button>
          </>
        }
      />

      {serverNotice && (
        <div className={`${ui.notice} !border-[color-mix(in_oklab,var(--warn)_25%,transparent)] !bg-[var(--warn-soft)] !text-[var(--warn)]`} role="status">
          <Icon name="info" size={15} className="mt-px shrink-0" />
          {serverNotice}
        </div>
      )}

      <section className={`${ui.panel} ${ui.panelFlush}`}>
        <div className={`${ui.panelHead} flex-col !items-stretch gap-3`}>
          <div className={ui.pillRow} role="tablist" aria-label="Log category">
            {LOG_TABS.map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                className={`${ui.pill} ${activeTab === tab ? ui.pillActive : ""}`}
                onClick={() => {
                  setActiveTab(tab);
                  setCurrentPage(1);
                }}
              >
                {tab}
              </button>
            ))}
          </div>
          <input
            type="text"
            className={`${ui.input} ${ui.search}`}
            placeholder="Search by user, action, target or keyword…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search logs"
          />
        </div>

        <div className={`${ui.tableWrap} ${ui.tableBare}`}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>When</th>
                <th>Operator</th>
                <th>Action</th>
                <th>Details</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {loading && !logs.length ? (
                <TableSkeletonRows cols={5} rows={6} />
              ) : !paginatedLogs.length ? (
                <TableEmptyRow
                  colSpan={5}
                  icon="logs"
                  title={query ? "No logs match your search" : "No activity recorded yet"}
                  body={query ? "Try a different keyword or category." : "Actions taken in your workspace will be recorded here."}
                />
              ) : (
                paginatedLogs.map((log) => {
                  const tone = actionTone(log.action, log.category);
                  const initial = log.user.name[0]?.toUpperCase() || "U";
                  const isAdmin = log.user.role === "admin";
                  return (
                    <tr key={log.id} onClick={() => setSelectedLog(log)} className="cursor-pointer" title="View log details">
                      <td className="whitespace-nowrap">
                        <span className="block font-medium">{timeAgo(log.timestamp)}</span>
                        <span className="font-mono text-[11.5px] text-[var(--faint)]">{formatFullDate(log.timestamp)}</span>
                      </td>
                      <td>
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={`grid size-8 shrink-0 place-items-center rounded-[9px] text-[12px] font-semibold ${
                              isAdmin ? "bg-[var(--brand-soft)] text-[var(--brand-ink)]" : "bg-[var(--info-soft)] text-[var(--info)]"
                            }`}
                          >
                            {initial}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate font-medium">{log.user.name}</span>
                              <span className={`${ui.chip} ${ui.chipXs} ${isAdmin ? ui.chipPos : ""} capitalize`}>{log.user.role}</span>
                            </div>
                            <span className="block truncate text-[12px] text-[var(--muted)]">{log.user.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`${ui.chip} ${TONE_CHIP[tone]} font-mono text-[11px] uppercase tracking-[0.02em]`}>{log.action.replace(/_/g, " ")}</span>
                      </td>
                      <td className="min-w-[240px] text-[var(--text-2)]">{log.details}</td>
                      <td>{log.target ? <span className={`${ui.chip} font-mono`}>{log.target}</span> : <span className="text-[var(--faint)]">—</span>}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalItems > 0 && (
          <PaginationControls
            currentPage={currentPage}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => setPageSize(size)}
            pageSizeOptions={[10, 25, 50, 100]}
            itemLabel="entries"
          />
        )}
      </section>

      {/* Log Detail Sheet */}
      {selectedLog && (
        <div
          className={ui.modal}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedLog(null);
          }}
        >
          <div className={ui.sheet} role="dialog" aria-modal="true" aria-label="Log record">
            <div className={ui.sheetHead}>
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={ui.iconTile}>
                  <Icon name="logs" size={15} />
                </span>
                <div className="min-w-0">
                  <h2>Log record</h2>
                  <span className={`${ui.chip} ${TONE_CHIP[actionTone(selectedLog.action, selectedLog.category)]} mt-1 font-mono text-[11px] uppercase`}>
                    {selectedLog.action.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
              <button className={ui.iconButton} onClick={() => setSelectedLog(null)} aria-label="Close">
                <Icon name="x" size={15} />
              </button>
            </div>

            <p className="m-0 mb-5 text-[14px] leading-relaxed text-[var(--text)]">{selectedLog.details}</p>

            <dl className={ui.kv}>
              <div>
                <dt>Record ID</dt>
                <dd className="font-mono text-[12.5px]">{selectedLog.id}</dd>
              </div>
              <div>
                <dt>Timestamp</dt>
                <dd className="font-mono text-[12.5px]">{formatFullDate(selectedLog.timestamp)}</dd>
              </div>
              <div>
                <dt>Operator</dt>
                <dd>
                  {selectedLog.user.name}
                  <span className="block text-[12px] font-normal text-[var(--muted)]">{selectedLog.user.email}</span>
                </dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd className="capitalize">{selectedLog.user.role}</dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>{selectedLog.category}</dd>
              </div>
              {selectedLog.target && (
                <div>
                  <dt>Target</dt>
                  <dd className="font-mono text-[12.5px]">{selectedLog.target}</dd>
                </div>
              )}
            </dl>

            {selectedLog.meta && Object.keys(selectedLog.meta).length > 0 && (
              <div className="mt-5">
                <p className="mb-2 mt-0 text-[12.5px] font-medium text-[var(--text-2)]">Metadata</p>
                <pre className="m-0 max-h-64 overflow-auto rounded-[10px] border border-[var(--border)] bg-[var(--sunken)] p-3.5 font-mono text-[11.5px] leading-relaxed text-[var(--text-2)]">
                  {JSON.stringify(selectedLog.meta, null, 2)}
                </pre>
              </div>
            )}

            <div className={ui.formActions}>
              <button className={ui.primary} onClick={() => setSelectedLog(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
