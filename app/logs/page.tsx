"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/app/components/toast-context";
import { ActivityCategory, ActivityLog, clearAllLogs } from "@/app/lib/logger";
import { api } from "@/app/lib/api";
import ui from "@/app/components/workspace-ui.module.css";

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

function getActionBadgeStyle(action: string, category: ActivityCategory): { bg: string; color: string; border: string } {
  if (action.includes("DELETE")) {
    return { bg: "#fee2e2", color: "#dc2626", border: "#fecaca" };
  }
  if (action.includes("CREATE") || action.includes("ADD") || action.includes("SIGNUP")) {
    return { bg: "#e6f4ed", color: "#006b3f", border: "#c3e9d7" };
  }
  if (action.includes("UPDATE") || action.includes("EDIT")) {
    return { bg: "#eef4ff", color: "#1d4ed8", border: "#dbeafe" };
  }
  if (action.includes("LOGIN") || action.includes("LOGOUT") || category === "Auth") {
    return { bg: "#f4f0fd", color: "#6b21a8", border: "#f3e8ff" };
  }
  if (category === "Visit") {
    return { bg: "#f3f4f6", color: "#4b5563", border: "#e5e7eb" };
  }
  return { bg: "#fff3eb", color: "#c2410c", border: "#ffedd5" };
}

export default function LogsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { showToast, confirmDialog } = useToast();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"All" | "Product & Stock" | "Categories" | "Staff" | "Auth & Sessions" | "Page Visits">("All");
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [serverNotice, setServerNotice] = useState("");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setServerNotice("");
    console.log("%c[Almadel Logs Dashboard] 📥 Starting to fetch activity logs...", "color: #0284c7; font-weight: bold");

    try {
      let serverLogs: ActivityLog[] = [];
      let isRouteFound = false;

      // 1. Fetch from GET /admin/logs
      try {
        console.log("%c[Almadel Logs Dashboard] 🔍 Attempt 1: Calling GET /admin/logs", "color: #6366f1; font-weight: 600");
        const response = await api<{ logs?: ActivityLog[]; data?: ActivityLog[] } | ActivityLog[]>("/admin/logs");
        isRouteFound = true;
        console.log("%c[Almadel Logs Dashboard] ✅ GET /admin/logs succeeded:", "color: #16a34a; font-weight: bold", response);

        if (Array.isArray(response)) {
          serverLogs = response;
        } else if (response && Array.isArray(response.logs)) {
          serverLogs = response.logs;
        } else if (response && Array.isArray(response.data)) {
          serverLogs = response.data;
        }
      } catch (err: any) {
        console.warn("%c[Almadel Logs Dashboard] ⚠️ GET /admin/logs failed:", "color: #d97706; font-weight: bold", err?.message || err);

        // 2. Fallback to GET /logs
        try {
          console.log("%c[Almadel Logs Dashboard] 🔍 Attempt 2: Calling fallback GET /logs", "color: #6366f1; font-weight: 600");
          const fallbackRes = await api<{ logs?: ActivityLog[]; data?: ActivityLog[] } | ActivityLog[]>("/logs");
          isRouteFound = true;
          console.log("%c[Almadel Logs Dashboard] ✅ GET /logs succeeded:", "color: #16a34a; font-weight: bold", fallbackRes);

          if (Array.isArray(fallbackRes)) {
            serverLogs = fallbackRes;
          } else if (fallbackRes && Array.isArray(fallbackRes.logs)) {
            serverLogs = fallbackRes.logs;
          } else if (fallbackRes && Array.isArray(fallbackRes.data)) {
            serverLogs = fallbackRes.data;
          }
        } catch (err2: any) {
          console.error("%c[Almadel Logs Dashboard] ❌ Fallback GET /logs also failed:", "color: #dc2626; font-weight: bold", err2?.message || err2);
        }
      }

      // If remote server hasn't been restarted with the new logs module yet, load DB stock logs
      if (!isRouteFound) {
        setServerNotice("Note: The remote backend server (65.108.249.169) does not have the new /admin/logs route deployed/restarted yet. Showing database stock movement logs.");
        console.log("%c[Almadel Logs Dashboard] 🔍 Attempt 3: Loading database stock movement logs from /stock/logs...", "color: #0284c7; font-weight: 600");

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
            console.log(`%c[Almadel Logs Dashboard] ✅ Loaded ${stockData.length} stock logs from database.`, "color: #16a34a; font-weight: bold");
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
            console.log("%c[Almadel Logs Dashboard] ℹ️ /stock/logs returned 0 records.", "color: #64748b");
          }
        } catch (stockErr) {
          console.error("%c[Almadel Logs Dashboard] ❌ Failed to fetch /stock/logs:", "color: #dc2626; font-weight: bold", stockErr);
        }
      }

      console.log(`%c[Almadel Logs Dashboard] 📊 Total logs loaded into state: ${serverLogs.length}`, "color: #059669; font-weight: bold");
      setLogs(serverLogs);
    } catch (err) {
      console.error("%c[Almadel Logs Dashboard] ❌ Critical failure during log load:", "color: #dc2626; font-weight: bold", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && user.role !== "admin") {
      showToast("Access restricted. Activity logs are available to system administrators only.", "error");
      router.replace("/products");
      return;
    }
    loadLogs();

    const handleLogAdded = () => {
      console.log("%c[Almadel Logs Dashboard] 🔔 almadel_log_added event received, refreshing logs...", "color: #6366f1; font-weight: 600");
      loadLogs();
    };
    const handleLogsCleared = () => {
      console.log("%c[Almadel Logs Dashboard] 🔔 almadel_logs_cleared event received, resetting state to []", "color: #e11d48; font-weight: 600");
      setLogs([]);
    };

    window.addEventListener("almadel_log_added", handleLogAdded);
    window.addEventListener("almadel_logs_cleared", handleLogsCleared);

    return () => {
      window.removeEventListener("almadel_log_added", handleLogAdded);
      window.removeEventListener("almadel_logs_cleared", handleLogsCleared);
    };
  }, [user, router, showToast, loadLogs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Category filter
      if (activeTab === "Product & Stock") {
        if (log.category !== "Product" && log.category !== "Stock") return false;
      } else if (activeTab === "Categories") {
        if (log.category !== "Category") return false;
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

  const handleExportCSV = () => {
    if (!logs.length) {
      showToast("No logs available to export.", "info");
      return;
    }

    const headers = ["Timestamp", "User Name", "User Email", "Role", "Category", "Action", "Details", "Target"];
    const rows = filteredLogs.map((log) => [
      `"${log.timestamp}"`,
      `"${log.user.name.replace(/"/g, '""')}"`,
      `"${log.user.email.replace(/"/g, '""')}"`,
      `"${log.user.role}"`,
      `"${log.category}"`,
      `"${log.action}"`,
      `"${log.details.replace(/"/g, '""')}"`,
      `"${(log.target || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `almadel-db-logs-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Database audit logs exported as CSV successfully.", "success");
  };

  const handleExportJSON = () => {
    if (!logs.length) {
      showToast("No logs available to export.", "info");
      return;
    }
    const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `almadel-db-logs-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Database audit logs exported as JSON successfully.", "success");
  };

  return (
    <WorkspaceShell>
      <div className={ui.head}>
        <div>
          <label>Audit & Security</label>
          <h1>System Activity Logs</h1>
          <p>Complete database audit log of product updates, stock shifts, category edits, and staff operations in PostgreSQL.</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className={ui.secondary} onClick={handleExportCSV} title="Export current filtered view to CSV file">
            Export CSV
          </button>
          <button className={ui.secondary} onClick={handleExportJSON} title="Export current filtered view to JSON file">
            Export JSON
          </button>
          <button className={ui.danger} onClick={handleClearAll} title="Clear database log records">
            Clear Database Logs
          </button>
        </div>
      </div>

      {serverNotice && (
        <div style={{ padding: "10px 16px", borderRadius: 12, background: "#fffbeb", border: "1px solid #fef3c7", color: "#92400e", fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
          {serverNotice}
        </div>
      )}

      {/* Category Tabs */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {(["All", "Product & Stock", "Categories", "Staff", "Auth & Sessions", "Page Visits"] as const).map((tab) => (
          <button
            key={tab}
            className={activeTab === tab ? ui.tabActive : ui.tab}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
        <input
          type="text"
          className={ui.input}
          placeholder="Search logs by user, action, target, keyword, or timestamp..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1 }}
        />
        <button className={ui.secondary} onClick={loadLogs} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Logs Table */}
      <section className={ui.card}>
        <div className={ui.tableWrapper}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User / Operator</th>
                <th>Action & Category</th>
                <th>Activity Details</th>
                <th>Target / Resource</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => {
                const badgeStyle = getActionBadgeStyle(log.action, log.category);
                const initial = log.user.name[0]?.toUpperCase() || "U";
                return (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    style={{ cursor: "pointer" }}
                    title="Click to view detailed log breakdown"
                  >
                    <td style={{ whiteSpace: "nowrap" }}>
                      <strong style={{ display: "block", fontSize: 13, color: "#111827" }}>
                        {timeAgo(log.timestamp)}
                      </strong>
                      <span className={ui.muted} style={{ fontSize: 11 }}>
                        {formatFullDate(log.timestamp)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 10,
                            background: log.user.role === "admin" ? "#e6f4ed" : "#eef4ff",
                            color: log.user.role === "admin" ? "#00875a" : "#1d4ed8",
                            fontWeight: 800,
                            fontSize: 12,
                            display: "grid",
                            placeItems: "center",
                            flexShrink: 0,
                          }}
                        >
                          {initial}
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <strong style={{ fontSize: 13, color: "#111827" }}>{log.user.name}</strong>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                padding: "2px 6px",
                                borderRadius: 9999,
                                background: log.user.role === "admin" ? "#e6f4ed" : "#f3f4f6",
                                color: log.user.role === "admin" ? "#006b3f" : "#4b5563",
                                textTransform: "capitalize",
                              }}
                            >
                              {log.user.role}
                            </span>
                          </div>
                          <span className={ui.muted} style={{ fontSize: 11 }}>{log.user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 10px",
                          borderRadius: 9999,
                          fontSize: 11,
                          fontWeight: 800,
                          background: badgeStyle.bg,
                          color: badgeStyle.color,
                          border: `1px solid ${badgeStyle.border}`,
                        }}
                      >
                        {log.action.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                        {log.details}
                      </span>
                    </td>
                    <td>
                      {log.target ? (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 8px",
                            borderRadius: 6,
                            background: "#f3f4f6",
                            color: "#4b5563",
                            fontSize: 11.5,
                            fontFamily: "monospace",
                            fontWeight: 700,
                          }}
                        >
                          {log.target}
                        </span>
                      ) : (
                        <span className={ui.muted}>-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && !filteredLogs.length && (
                <tr>
                  <td colSpan={5} className={ui.empty}>
                    {query ? "No activity logs match your search filter." : "No activity logs recorded in the database yet."}
                  </td>
                </tr>
              )}
              {loading && !logs.length && (
                <tr>
                  <td colSpan={5} className={ui.empty}>
                    Loading activity logs from database...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div
          className={ui.modal}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedLog(null);
          }}
        >
          <div className={ui.sheet}>
            <div className={ui.sheetHead}>
              <h2>Database Log Record</h2>
              <button className={ui.secondary} onClick={() => setSelectedLog(null)}>
                Close
              </button>
            </div>
            <div className="space-y-4 text-xs font-medium text-gray-700">
              <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-gray-50 border border-gray-200">
                <div>
                  <span className="text-gray-500 font-bold block">Database ID:</span>
                  <strong className="text-gray-900 font-mono">{selectedLog.id}</strong>
                </div>
                <div>
                  <span className="text-gray-500 font-bold block">Timestamp:</span>
                  <strong className="text-gray-900">{formatFullDate(selectedLog.timestamp)}</strong>
                </div>
                <div>
                  <span className="text-gray-500 font-bold block">Operator:</span>
                  <strong className="text-gray-900">{selectedLog.user.name} ({selectedLog.user.email})</strong>
                </div>
                <div>
                  <span className="text-gray-500 font-bold block">Role:</span>
                  <strong className="text-gray-900 capitalize">{selectedLog.user.role}</strong>
                </div>
              </div>

              <div>
                <span className="text-gray-500 font-bold block mb-1">Full Description:</span>
                <p className="p-3.5 rounded-2xl bg-[#e6f4ed] border border-[#c3e9d7] text-[#006b3f] font-bold text-sm">
                  {selectedLog.details}
                </p>
              </div>

              {selectedLog.meta && Object.keys(selectedLog.meta).length > 0 && (
                <div>
                  <span className="text-gray-500 font-bold block mb-1">Metadata Payload:</span>
                  <pre className="p-3 bg-gray-900 text-green-400 rounded-2xl overflow-x-auto text-[11px] font-mono">
                    {JSON.stringify(selectedLog.meta, null, 2)}
                  </pre>
                </div>
              )}
            </div>
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
