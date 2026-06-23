import { useNavigate } from "react-router-dom";
import { getCurrentUser, logout } from "../lib/api";

export function Dashboard() {
  const user = getCurrentUser();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">שלום, {user.fullName}</h1>
        <button onClick={handleLogout} className="rounded-lg bg-slate-200 px-4 py-2 text-sm">
          התנתק
        </button>
      </header>

      {user.role === "site_manager" && (
        <p className="text-slate-600">
          כאן יוצג ה-UI הפשוט למובייל: היומנים הפתוחים שהוקצו לך, והוספת שורות (חומר/עבודה/ציוד/שירות).
        </p>
      )}
      {(user.role === "engineer" || user.role === "admin") && (
        <p className="text-slate-600">
          כאן יוצג דשבורד הניהול: פרויקטים, יומנים, אישור שורות בכמות, ומעקב תקציב.
        </p>
      )}
    </div>
  );
}
