import { useEffect, useState, type FormEvent } from "react";
import {
  assignUserToProject,
  createProject,
  createUser,
  listProjects,
  listUsers,
  openDailyLog,
  type Project,
} from "../lib/api";

export function AdminHome() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [siteManagers, setSiteManagers] = useState<{ id: string; fullName: string }[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    listProjects().then(setProjects).catch((e) => setError(String(e)));
    listUsers("site_manager").then(setSiteManagers).catch((e) => setError(String(e)));
  }

  useEffect(refresh, []);

  async function handle(action: () => Promise<unknown>, successMsg: string) {
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(successMsg);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "פעולה נכשלה");
    }
  }

  async function onCreateProject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await handle(
      () => createProject({ code: String(form.get("code")), name: String(form.get("name")) }),
      "פרויקט נוצר",
    );
    e.currentTarget.reset();
  }

  async function onCreateUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await handle(
      () =>
        createUser({
          fullName: String(form.get("fullName")),
          email: String(form.get("email")),
          password: String(form.get("password")),
          role: form.get("role") as "admin" | "engineer" | "site_manager",
        }),
      "משתמש נוצר",
    );
    e.currentTarget.reset();
  }

  async function onAssign(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await handle(
      () => assignUserToProject(String(form.get("projectId")), String(form.get("userId"))),
      "המשתמש שויך לפרויקט",
    );
  }

  async function onOpenLog(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await handle(
      () =>
        openDailyLog({
          projectId: String(form.get("projectId")),
          logDate: String(form.get("logDate")),
          siteManagerId: String(form.get("siteManagerId")),
        }),
      "יומן נפתח",
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {message && <p className="md:col-span-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}
      {error && <p className="md:col-span-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      <section className="rounded-2xl bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-bold">פרויקט חדש</h2>
        <form onSubmit={onCreateProject} className="space-y-3">
          <input name="code" placeholder="קוד פרויקט" required className="w-full rounded-lg border p-3" />
          <input name="name" placeholder="שם פרויקט" required className="w-full rounded-lg border p-3" />
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-white">צור פרויקט</button>
        </form>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-bold">משתמש חדש</h2>
        <form onSubmit={onCreateUser} className="space-y-3">
          <input name="fullName" placeholder="שם מלא" required className="w-full rounded-lg border p-3" />
          <input name="email" type="email" placeholder="אימייל" required className="w-full rounded-lg border p-3" />
          <input
            name="password"
            type="password"
            placeholder="סיסמה (8+ תווים)"
            required
            minLength={8}
            className="w-full rounded-lg border p-3"
          />
          <select name="role" required className="w-full rounded-lg border p-3">
            <option value="site_manager">מנהל עבודה</option>
            <option value="engineer">מהנדס</option>
            <option value="admin">בקר תקציבי / אדמין</option>
          </select>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-white">צור משתמש</button>
        </form>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-bold">שיוך מנהל עבודה לפרויקט</h2>
        <form onSubmit={onAssign} className="space-y-3">
          <select name="projectId" required className="w-full rounded-lg border p-3">
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
          <select name="userId" required className="w-full rounded-lg border p-3">
            {siteManagers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </select>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-white">שייך</button>
        </form>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-bold">פתיחת יומן עבודה</h2>
        <form onSubmit={onOpenLog} className="space-y-3">
          <select name="projectId" required className="w-full rounded-lg border p-3">
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
          <select name="siteManagerId" required className="w-full rounded-lg border p-3">
            {siteManagers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </select>
          <input name="logDate" type="date" required className="w-full rounded-lg border p-3" />
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-white">פתח יומן</button>
        </form>
      </section>
    </div>
  );
}
