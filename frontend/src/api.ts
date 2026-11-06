
const API_URL = "https://nexa-flow-projectb.vercel.app";

export function getToken(): string | null {
  return localStorage.getItem("nexaflow_token");
}

export function saveToken(token: string): void {
  localStorage.setItem("nexaflow_token", token);
}

export function removeToken(): void {
  localStorage.removeItem("nexaflow_token");
}

export async function apiFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getToken();

  const headers = new Headers(options.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });
}
