/**
 * En production derrière Nginx : appels relatifs `/api/v1/...` (même origine).
 * Côté serveur (SSR) : INTERNAL_API_URL pointe vers le conteneur `api` Docker.
 */
function getApiRoot(): string {
  if (typeof window !== "undefined") {
    return "";
  }
  const url =
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8000";
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

let refreshPromise: Promise<boolean> | null = null;

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("refresh_token");
}

async function refreshAccessToken(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    const response = await fetch(buildUrl("/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) return false;

    const data = (await response.json()) as { access_token: string; refresh_token: string };
    setTokens(data.access_token, data.refresh_token);
    return true;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
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
  const request = async (): Promise<Response> => {
    const token = getToken();
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };
    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }
    return fetch(buildUrl(path), { ...options, headers });
  };

  let res = await request();
  if (res.status === 401 && getRefreshToken()) {
    const refreshed = await refreshAccessToken().catch(() => false);
    if (refreshed) {
      res = await request();
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = parseErrorDetail(err, res.statusText);
    if (res.status === 404) {
      throw new ApiError(
        res.status,
        `Service API introuvable (${buildUrl(path)}). Vérifiez Nginx et que l'API tourne.`,
      );
    }
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new ApiError(
        res.status,
        "Service API indisponible (Bad Gateway). L'API redémarre peut-être — réessayez dans quelques secondes.",
      );
    }
    throw new ApiError(res.status, message || "Erreur API");
  }
  if (res.status === 204) return undefined as T;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("text/csv") || contentType.startsWith("text/")) {
    return (await res.text()) as T;
  }
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
