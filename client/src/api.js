// Small fetch wrapper: attaches the session token, unwraps errors.

export function getToken() {
  return localStorage.getItem("rp_token");
}
export function setToken(token) {
  if (token) localStorage.setItem("rp_token", token);
  else localStorage.removeItem("rp_token");
}

export async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && getToken() && !path.startsWith("/login")) {
      setToken(null);
      window.location.href = "/login";
    }
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}
