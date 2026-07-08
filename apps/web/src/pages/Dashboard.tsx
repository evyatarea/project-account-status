import { useNavigate } from "react-router-dom";
import { getCurrentUser, logout } from "../lib/api";
import { SiteManagerHome } from "./SiteManagerHome";
import { AdminHome } from "./AdminHome";

export function Dashboard() {
  const user = getCurrentUser();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between bg-white p-4 shadow-sm">
        <h1 className="text-lg font-bold text-slate-800">שלום, {user.fullName}</h1>
        <button onClick={handleLogout} className="rounded-lg bg-slate-200 px-4 py-2 text-sm">
          התנתק
        </button>
      </header>

      <main className="p-4">
        {user.role === "site_manager" && <SiteManagerHome />}
        {(user.role === "engineer" || user.role === "admin") && <AdminHome />}
      </main>
    </div>
  );
}
