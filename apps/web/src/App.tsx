import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { getCurrentUser } from "./lib/api";

function RequireAuth({ children }: { children: React.ReactNode }) {
  return getCurrentUser() ? <>{children}</> : <Navigate to="/login" replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
