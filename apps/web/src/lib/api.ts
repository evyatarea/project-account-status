const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

function getToken(): string | null {
  return localStorage.getItem("token");
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function login(email: string, password: string) {
  const data = await apiFetch<{ token: string; user: { id: string; fullName: string; role: string } }>(
    "/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) },
  );
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
  return data.user;
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function getCurrentUser(): { id: string; fullName: string; role: string } | null {
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}
