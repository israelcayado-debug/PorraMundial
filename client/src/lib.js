const basePath = import.meta.env.BASE_URL || "/";
const storagePrefix = `porra_${basePath.replace(/[^a-z0-9]/gi, "_")}`;
const tokenKey = `${storagePrefix}_token`;
const userKey = `${storagePrefix}_user`;

function clearLegacyPersistentSession() {
  localStorage.removeItem(tokenKey);
  localStorage.removeItem(userKey);
}

export function appAsset(path) {
  return `${basePath}${path.replace(/^\/+/, "")}`;
}

export function appPath(path) {
  const cleanPath = path.replace(/^\/+/, "");
  return `${basePath}${cleanPath}`;
}

export async function api(path, options = {}) {
  clearLegacyPersistentSession();
  const token = sessionStorage.getItem(tokenKey);
  const response = await fetch(appPath(path), {
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
  clearLegacyPersistentSession();
  sessionStorage.setItem(tokenKey, token);
  sessionStorage.setItem(userKey, JSON.stringify(user));
}

export function clearSession() {
  clearLegacyPersistentSession();
  sessionStorage.removeItem(tokenKey);
  sessionStorage.removeItem(userKey);
}

export function loadStoredUser() {
  clearLegacyPersistentSession();
  const raw = sessionStorage.getItem(userKey);
  return raw ? JSON.parse(raw) : null;
}
