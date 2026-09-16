"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { api, StaffItem } from "@/app/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/app/components/toast-context";
import { logActivity } from "@/app/lib/logger";
import ui from "@/app/components/workspace-ui.module.css";

type Draft = { fullName: string; email: string; password: string; confirm: string };
const blank: Draft = { fullName: "", email: "", password: "", confirm: "" };

const money = (n: number) => `Rs ${Math.round(n).toLocaleString()}`;

export default function StaffPage() {
  const { user } = useAuth();
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
      const msg = e instanceof Error ? e.message : "Could not load staff.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (user && user.role !== "admin") router.replace("/dashboard");
  }, [user, router]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const totals = useMemo(
    () =>
      staff.reduce(
        (a, x) => ({
          sales: a.sales + x.stats.totalSales,
          items: a.items + x.stats.totalItemsSold,
        }),
        { sales: 0, items: 0 }
      ),
    [staff]
  );

  const open = (item?: StaffItem) => {
    setDraft(
      item
        ? { fullName: item.user.fullName ?? "", email: item.user.email, password: "", confirm: "" }
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
        ...(draft.password ? { password: draft.password } : {}),
      };
      await api(modal?.item ? `/admin/staff/${modal.item.user.id}` : "/admin/staff", {
        method: modal?.item ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      setModal(null);
      const msg = modal?.item ? "Staff account updated successfully." : "Staff account created successfully.";
      setNotice(msg);
      showToast(msg, "success");

      logActivity(
        modal?.item ? "STAFF_UPDATE" : "STAFF_CREATE",
        "Staff",
        modal?.item
          ? `Updated staff account for '${draft.fullName}' (${draft.email})`
          : `Created new staff account for '${draft.fullName}' (${draft.email})`,
        draft.fullName || draft.email,
        { email: draft.email, fullName: draft.fullName }
      );

      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save staff.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: StaffItem) {
    const name = item.user.fullName ?? item.user.email;
    const confirmed = await confirmDialog({
      title: "Delete Staff Account",
      message: `Are you sure you want to delete staff account for "${name}"? Their past sales will remain recorded in reports.`,
      confirmLabel: "Delete Account",
      danger: true,
    });
    if (!confirmed) return;

    try {
      await api(`/admin/staff/${item.user.id}`, { method: "DELETE" });
      const msg = `Staff account for "${name}" deleted.`;
      setNotice(msg);
      showToast(msg, "success");

      logActivity(
        "STAFF_DELETE",
        "Staff",
        `Deleted staff account for '${name}' (${item.user.email})`,
        name,
        { userId: item.user.id, email: item.user.email }
      );

      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not delete staff.";
      setError(msg);
      showToast(msg, "error");
    }
  }

  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return staff;
    return staff.filter((item) =>
      [item.user.fullName, item.user.email].some((v) =>
        String(v ?? "").toLowerCase().includes(q)
      )
    );
  }, [staff, query]);

  return (
    <WorkspaceShell>
      <div className={ui.head}>
        <div>
          <label>Admin</label>
          <h1>Staff Management</h1>
          <p>Every staff account with its own products, sales, and stock activity.</p>
        </div>
        <button className={ui.primary} onClick={() => open()}>
          ＋ Add staff
        </button>
      </div>

      {error && <div className={ui.error}>{error}</div>}
      {notice && <div className={ui.notice}>{notice}</div>}

      <section className={ui.metrics}>
        <div className={ui.metric}>
          <span>Staff</span>
          <strong>{staff.length}</strong>
        </div>
        <div className={ui.metric}>
          <span>Staff sales</span>
          <strong>{money(totals.sales)}</strong>
        </div>
        <div className={ui.metric}>
          <span>Items sold</span>
          <strong>{totals.items}</strong>
        </div>
      </section>

      <div className={ui.toolbar}>
        <input
          className={`${ui.input} ${ui.search}`}
          placeholder="Search staff by name or email…"
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
                <th>Staff Member</th>
                <th>Role / Status</th>
                <th>Total Sales</th>
                <th>Orders</th>
                <th>Items Sold</th>
                <th>Avg. Sale</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((item) => {
                const name = item.user.fullName || "Unnamed staff";
                const initial = name[0]?.toUpperCase() || "S";
                return (
                  <tr key={item.user.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 12,
                            background: "#e6f4ed",
                            color: "#00875a",
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
                        <span className={ui.badge}>Staff</span>
                        <span className={`${ui.badge} ${ui.success}`}>Active</span>
                      </div>
                    </td>
                    <td>
                      <strong style={{ color: "#00875a", fontSize: 13.5 }}>
                        {money(item.stats.totalSales)}
                      </strong>
                    </td>
                    <td>
                      <strong>{item.stats.sales}</strong>
                    </td>
                    <td>
                      <strong>{item.stats.totalItemsSold}</strong>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: "#374151" }}>
                        {money(item.stats.sales ? item.stats.totalSales / item.stats.sales : 0)}
                      </span>
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
                    {query ? "No staff accounts match your search." : "No staff accounts found."}
                  </td>
                </tr>
              )}
              {loading && !staff.length && (
                <tr>
                  <td colSpan={7} className={ui.empty}>
                    Loading staff accounts…
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
              <h2>{modal.item ? "Edit staff" : "Add staff"}</h2>
              <button type="button" className={ui.secondary} onClick={() => setModal(null)}>
                Close
              </button>
            </div>
            <div className={ui.formGrid}>
              <Field label="Full name">
                <input
                  className={ui.input}
                  value={draft.fullName}
                  onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
                />
              </Field>
              <Field label="Email address">
                <input
                  className={ui.input}
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                />
              </Field>
              <Field label={modal.item ? "New password (optional)" : "Password"}>
                <input
                  className={ui.input}
                  type="password"
                  value={draft.password}
                  onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                />
              </Field>
              <Field label="Confirm password">
                <input
                  className={ui.input}
                  type="password"
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
                {saving ? "Saving…" : modal.item ? "Save changes" : "Add staff"}
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
