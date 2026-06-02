const basePath = import.meta.env.BASE_URL || "/";
const storagePrefix = `porra_${basePath.replace(/[^a-z0-9]/gi, "_")}`;

export function appAsset(path) {
  return `${basePath}${path.replace(/^\/+/, "")}`;
}

export function appPath(path) {
  const cleanPath = path.replace(/^\/+/, "");
  return `${basePath}${cleanPath}`;
}

export async function api(path, options = {}) {
  const token = localStorage.getItem(`${storagePrefix}_token`);
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
  localStorage.setItem(`${storagePrefix}_token`, token);
  localStorage.setItem(`${storagePrefix}_user`, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(`${storagePrefix}_token`);
  localStorage.removeItem(`${storagePrefix}_user`);
}

export function loadStoredUser() {
  const raw = localStorage.getItem(`${storagePrefix}_user`);
  return raw ? JSON.parse(raw) : null;
}
