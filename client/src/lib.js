export async function api(path, options = {}) {
  const token = localStorage.getItem("porra_token");
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Error inesperado");
  }

  return data;
}

export function saveSession(token, user) {
  localStorage.setItem("porra_token", token);
  localStorage.setItem("porra_user", JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem("porra_token");
  localStorage.removeItem("porra_user");
}

export function loadStoredUser() {
  const raw = localStorage.getItem("porra_user");
  return raw ? JSON.parse(raw) : null;
}
