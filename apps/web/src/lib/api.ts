/**
 * En production derrière Nginx : appels relatifs `/api/v1/...` (même origine).
 * Évite les 404 si NEXT_PUBLIC_API_URL a été mal configuré au build Docker.
 */
function getApiRoot(): string {
  if (typeof window !== "undefined") {
    return "";
  }
  const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  return url.replace(/\/$/, "");
}

function buildUrl(path: string): string {
  const root = getApiRoot();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return root ? `${root}/api/v1${normalized}` : `/api/v1${normalized}`;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

function parseErrorDetail(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => (typeof d === "object" && d && "msg" in d ? String((d as { msg: string }).msg) : String(d)))
      .join(", ");
  }
  return fallback;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(buildUrl(path), { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = parseErrorDetail(err, res.statusText);
    if (res.status === 404) {
      throw new ApiError(
        res.status,
        `Service API introuvable (${buildUrl(path)}). Vérifiez Nginx et que l'API tourne.`,
      );
    }
    throw new ApiError(res.status, message || "Erreur API");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
}

export function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("access_token");
}
