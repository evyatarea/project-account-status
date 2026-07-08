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

export type ResourceType = "material" | "labor" | "equipment" | "service";

export interface Item {
  id: string;
  itemCode: string;
  description: string;
  resourceType: ResourceType;
  unit: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
}

export interface DailyLog {
  id: string;
  projectId: string;
  logDate: string;
  siteManagerId: string;
  status: "open" | "closed";
}

export interface ResourceRow {
  id: string;
  dailyLogId: string;
  resourceType: ResourceType;
  itemId: string | null;
  quantityReported: string;
  unit: string;
  deliveryTicketNumber: string | null;
  paymentStatus: string;
  createdAt: string;
}

export const listProjects = () => apiFetch<Project[]>("/projects");
export const listItems = () => apiFetch<Item[]>("/items");
export const listDailyLogs = (params: { projectId?: string } = {}) => {
  const qs = params.projectId ? `?projectId=${params.projectId}` : "";
  return apiFetch<DailyLog[]>(`/daily-logs${qs}`);
};
export const listResourceRows = (dailyLogId: string) =>
  apiFetch<ResourceRow[]>(`/resource-rows?dailyLogId=${dailyLogId}`);

export const createResourceRow = (input: {
  dailyLogId: string;
  resourceType: ResourceType;
  itemId?: string;
  quantityReported: number;
  unit: string;
  deliveryTicketNumber?: string;
}) => apiFetch<ResourceRow>("/resource-rows", { method: "POST", body: JSON.stringify(input) });

export const createProject = (input: { code: string; name: string }) =>
  apiFetch<Project>("/projects", { method: "POST", body: JSON.stringify(input) });

export const createUser = (input: {
  fullName: string;
  email: string;
  password: string;
  role: "admin" | "engineer" | "site_manager";
}) => apiFetch("/users", { method: "POST", body: JSON.stringify(input) });

export const listUsers = (role?: string) =>
  apiFetch<{ id: string; fullName: string; email: string; role: string }[]>(
    `/users${role ? `?role=${role}` : ""}`,
  );

export const assignUserToProject = (projectId: string, userId: string) =>
  apiFetch(`/projects/${projectId}/assignments`, { method: "POST", body: JSON.stringify({ userId }) });

export const openDailyLog = (input: { projectId: string; logDate: string; siteManagerId: string }) =>
  apiFetch<DailyLog>("/daily-logs", { method: "POST", body: JSON.stringify(input) });
