"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { api, StaffItem } from "@/app/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness } from "@/app/components/business-context";
import { useToast } from "@/app/components/toast-context";
import { logActivity } from "@/app/lib/logger";
import ui from "@/app/components/workspace-ui.module.css";

type Draft = { fullName: string; email: string; password: string; confirm: string; role: "staff" | "accountant" };
const blank: Draft = { fullName: "", email: "", password: "", confirm: "", role: "staff" };

const money = (n: number) => `Rs ${Math.round(n).toLocaleString()}`;

export default function StaffPage() {
  const { user } = useAuth();
  const { activeBusiness } = useBusiness();
  const router = useRouter();
  const { showToast, confirmDialog } = useToast();
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<null | { item?: StaffItem }>(null);
  const [draft, setDraft] = useState(blank);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setStaff((await api<{ staff: StaffItem[] }>("/admin/staff")).staff);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load team members.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, activeBusiness?.id]);

  useEffect(() => {
    if (user && user.role !== "admin") router.replace("/dashboard");
  }, [user, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onRealtimeEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ event?: string }>).detail;
      if (detail?.event === "staff.created" || detail?.event === "staff.updated" || detail?.event === "staff.deleted") {
        void load();
      }
    };
    window.addEventListener("almadel_realtime_event", onRealtimeEvent);
    return () => window.removeEventListener("almadel_realtime_event", onRealtimeEvent);
  }, [load]);

  const totals = useMemo(
    () =>
      staff.reduce(
        (a, x) => ({
          sales: a.sales + x.stats.totalSales,
          items: a.items + x.stats.totalItemsSold,
          staffCount: a.staffCount + (x.user.role === "staff" ? 1 : 0),
          accountantCount: a.accountantCount + (x.user.role === "accountant" ? 1 : 0),
        }),
        { sales: 0, items: 0, staffCount: 0, accountantCount: 0 }
      ),
    [staff]
  );

  const open = (item?: StaffItem) => {
    setDraft(
      item
        ? {
            fullName: item.user.fullName ?? "",
            email: item.user.email,
            password: "",
            confirm: "",
            role: item.user.role === "accountant" ? "accountant" : "staff",
          }
        : blank
    );
    setModal({ item });
    setError("");
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft.fullName.trim() || !draft.email.includes("@")) {
      const msg = "Enter a valid full name and email address.";
      setError(msg);
      showToast(msg, "error");
      return;
    }
    if ((!modal?.item || draft.password) && draft.password.length < 8) {
      const msg = "Password must contain at least 8 characters.";
      setError(msg);
      showToast(msg, "error");
      return;
    }
    if (draft.password !== draft.confirm) {
      const msg = "Passwords do not match.";
      setError(msg);
      showToast(msg, "error");
      return;
    }
    setSaving(true);
    try {
      const body = {
        fullName: draft.fullName.trim(),
        email: draft.email.trim(),
        role: draft.role,
        ...(draft.password ? { password: draft.password } : {}),
      };
      await api(modal?.item ? `/admin/staff/${modal.item.user.id}` : "/admin/staff", {
        method: modal?.item ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      setModal(null);
      const roleLabel = draft.role === "accountant" ? "Accountant" : "Staff member";
      const msg = modal?.item
        ? draft.password
          ? `${roleLabel} updated & credentials emailed.`
          : `${roleLabel} updated successfully.`
        : `${roleLabel} created successfully! Credentials emailed to ${draft.email}.`;
      setNotice(msg);
      showToast(msg, "success");


      logActivity(
        modal?.item ? "STAFF_UPDATE" : "STAFF_CREATE",
        "Staff",
        modal?.item
          ? `Updated ${draft.role} account for '${draft.fullName}' (${draft.email})`
          : `Created new ${draft.role} account for '${draft.fullName}' (${draft.email})`,
        draft.fullName || draft.email,
        { email: draft.email, fullName: draft.fullName, role: draft.role }
      );

      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save team member.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: StaffItem) {
    const name = item.user.fullName ?? item.user.email;
    const roleLabel = item.user.role === "accountant" ? "accountant" : "staff";
    const confirmed = await confirmDialog({
      title: `Delete ${item.user.role === "accountant" ? "Accountant" : "Staff"} Account`,
      message: `Are you sure you want to delete the ${roleLabel} account for "${name}"? Their past transactions will remain recorded in reports.`,
      confirmLabel: "Delete Account",
      danger: true,
    });
    if (!confirmed) return;

    try {
      await api(`/admin/staff/${item.user.id}`, { method: "DELETE" });
      const msg = `${item.user.role === "accountant" ? "Accountant" : "Staff"} account for "${name}" deleted.`;
      setNotice(msg);
      showToast(msg, "success");

      logActivity(
        "STAFF_DELETE",
        "Staff",
        `Deleted ${roleLabel} account for '${name}' (${item.user.email})`,
        name,
        { userId: item.user.id, email: item.user.email, role: item.user.role }
      );

      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not delete team member.";
      setError(msg);
      showToast(msg, "error");
    }
  }

  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return staff;
    return staff.filter((item) =>
      [item.user.fullName, item.user.email, item.user.role].some((v) =>
        String(v ?? "").toLowerCase().includes(q)
      )
    );
  }, [staff, query]);

  return (
    <WorkspaceShell>
      <div className={ui.head}>
        <div>
          <label>Admin</label>
          <h1>Staff & Team Management</h1>
          <p>Add staff (POS counter) and accountants (finance books, balance sheets & reports).</p>
        </div>
        <button className={ui.primary} onClick={() => open()}>
          + Add Team Member
        </button>
      </div>

      {error && <div className={ui.error}>{error}</div>}
      {notice && <div className={ui.notice}>{notice}</div>}

      <section className={ui.metrics}>
        <div className={ui.metric}>
          <span>Staff Members</span>
          <strong>{totals.staffCount}</strong>
        </div>
        <div className={ui.metric}>
          <span>Accountants</span>
          <strong>{totals.accountantCount}</strong>
        </div>
        <div className={ui.metric}>
          <span>POS Staff Sales</span>
          <strong>{money(totals.sales)}</strong>
        </div>
        <div className={ui.metric}>
          <span>Items Sold</span>
          <strong>{totals.items}</strong>
        </div>
      </section>

      <div className={ui.toolbar}>
        <input
          className={`${ui.input} ${ui.search}`}
          placeholder="Search team members by name, email, or role…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className={ui.secondary} onClick={() => void load()}>
          Refresh
        </button>
      </div>

      <section className={ui.panel}>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Member</th>
                <th>Role & Access</th>
                <th>Total Sales</th>
                <th>Orders</th>
                <th>Items Sold</th>
                <th>Avg. Sale</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((item) => {
                const name = item.user.fullName || "Unnamed member";
                const initial = name[0]?.toUpperCase() || "M";
                const isAccountant = item.user.role === "accountant";

                return (
                  <tr key={item.user.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 12,
                            background: isAccountant ? "#ede9fe" : "#e6f4ed",
                            color: isAccountant ? "#6d28d9" : "#00875a",
                            fontWeight: 800,
                            fontSize: 14,
                            display: "grid",
                            placeItems: "center",
                            flexShrink: 0,
                          }}
                        >
                          {initial}
                        </div>
                        <div>
                          <strong style={{ fontSize: 13.5, color: "#111827", display: "block" }}>
                            {name}
                          </strong>
                          <span className={ui.muted}>{item.user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {isAccountant ? (
                          <span
                            className={ui.badge}
                            style={{
                              background: "#f5f3ff",
                              color: "#6d28d9",
                              borderColor: "#ddd6fe",
                              fontWeight: 700,
                            }}
                          >
                            Accountant
                          </span>
                        ) : (
                          <span className={ui.badge}>Staff</span>
                        )}
                        <span className={`${ui.badge} ${ui.success}`}>Active</span>
                      </div>
                    </td>
                    <td>
                      {isAccountant ? (
                        <span className={ui.muted} style={{ fontSize: 12 }}>Financials only</span>
                      ) : (
                        <strong style={{ color: "#00875a", fontSize: 13.5 }}>
                          {money(item.stats.totalSales)}
                        </strong>
                      )}
                    </td>
                    <td>
                      {isAccountant ? <span className={ui.muted}>—</span> : <strong>{item.stats.sales}</strong>}
                    </td>
                    <td>
                      {isAccountant ? <span className={ui.muted}>—</span> : <strong>{item.stats.totalItemsSold}</strong>}
                    </td>
                    <td>
                      {isAccountant ? (
                        <span className={ui.muted}>—</span>
                      ) : (
                        <span style={{ fontWeight: 600, color: "#374151" }}>
                          {money(item.stats.sales ? item.stats.totalSales / item.stats.sales : 0)}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className={ui.actions}>
                        <button className={ui.secondary} onClick={() => open(item)}>
                          Edit
                        </button>
                        <button className={ui.danger} onClick={() => void remove(item)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && !shown.length && (
                <tr>
                  <td colSpan={7} className={ui.empty}>
                    {query ? "No team members match your search." : "No team members found."}
                  </td>
                </tr>
              )}
              {loading && !staff.length && (
                <tr>
                  <td colSpan={7} className={ui.empty}>
                    Loading team members…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modal && (
        <div
          className={ui.modal}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <form className={ui.sheet} onSubmit={submit}>
            <div className={ui.sheetHead}>
              <h2>{modal.item ? "Edit Team Member" : "Add Team Member"}</h2>
              <button type="button" className={ui.secondary} onClick={() => setModal(null)}>
                Close
              </button>
            </div>
            <div className={ui.formGrid}>
              <div
                style={{
                  gridColumn: "1 / -1",
                  padding: "10px 14px",
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: 10,
                  fontSize: 12,
                  color: "#166534",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontWeight: 600,
                }}
              >
                <span>📧</span>
                <span>
                  {modal.item
                    ? "If password is changed, updated login credentials will be emailed to the user."
                    : "Login credentials will be automatically sent to the user's email address."}
                </span>
              </div>
              <Field label="Full name">

                <input
                  className={ui.input}
                  placeholder="e.g. Ali Ahmed"
                  value={draft.fullName}
                  onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
                  required
                />
              </Field>
              <Field label="Email address">
                <input
                  className={ui.input}
                  type="email"
                  placeholder="e.g. ali@company.com"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  required
                />
              </Field>
              <Field label="Role & Access Permission">
                <select
                  className={ui.input}
                  value={draft.role}
                  onChange={(e) => setDraft({ ...draft, role: e.target.value as "staff" | "accountant" })}
                >
                  <option value="staff">Staff — Sales Counter & POS Only</option>
                  <option value="accountant">Accountant — Accounts, Balance Sheets & Financial Reports</option>
                </select>
              </Field>
              <Field label={modal.item ? "New password (leave blank to keep current)" : "Password"}>
                <input
                  className={ui.input}
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={draft.password}
                  onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                />
              </Field>
              <Field label="Confirm password">
                <input
                  className={ui.input}
                  type="password"
                  placeholder="Re-enter password"
                  value={draft.confirm}
                  onChange={(e) => setDraft({ ...draft, confirm: e.target.value })}
                />
              </Field>
            </div>
            <div className={ui.formActions}>
              <button type="button" className={ui.secondary} onClick={() => setModal(null)}>
                Cancel
              </button>
              <button className={ui.primary} disabled={saving}>
                {saving ? "Saving…" : modal.item ? "Save changes" : "Add Member"}
              </button>
            </div>
          </form>
        </div>
      )}
    </WorkspaceShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={ui.field}>
      <label>{label}</label>
      {children}
    </div>
  );
}

