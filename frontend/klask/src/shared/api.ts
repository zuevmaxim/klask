const API_URL = import.meta.env.VITE_API_URL || (location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api');

type CreateStateClientOptions = {
  path: string;
  tokenKey: string;
  credentials?: RequestCredentials;
};

export function createStateClient({ path, tokenKey, credentials }: CreateStateClientOptions) {
  const getToken = () => localStorage.getItem(tokenKey);
  const setToken = (token: string) => localStorage.setItem(tokenKey, token);
  const clearToken = () => localStorage.removeItem(tokenKey);
  const hasToken = () => !!getToken();
  const authHeaders = () => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  async function login(username: string, password: string) {
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error('Invalid credentials');
    const { token } = await res.json();
    setToken(token);
    return token as string;
  }

  async function loadState<T = unknown>() {
    const res = await fetch(`${API_URL}${path}`, { headers: authHeaders(), credentials });
    if (res.status === 401) {
      clearToken();
      throw new Error('Unauthorized');
    }
    if (!res.ok) throw new Error('Failed to load state');
    return res.json() as Promise<T>;
  }

  async function loadStats<T = unknown>() {
    const res = await fetch(`${API_URL}${path}/stats`, { headers: authHeaders(), credentials });
    if (res.status === 401) {
      clearToken();
      throw new Error('Unauthorized');
    }
    if (!res.ok) throw new Error('Failed to load stats');
    return res.json() as Promise<T>;
  }

  async function loadMatches<T = unknown>(page = 0, limit = 100) {
    const res = await fetch(`${API_URL}${path}/matches?page=${page}&limit=${limit}`, { headers: authHeaders(), credentials });
    if (res.status === 401) {
      clearToken();
      throw new Error('Unauthorized');
    }
    if (!res.ok) throw new Error('Failed to load matches');
    return res.json() as Promise<T>;
  }

  async function saveState<T>(state: T, cause: string) {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      credentials,
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ ...(state as object), cause }),
    });
    if (res.status === 401) {
      clearToken();
      throw new Error('Unauthorized');
    }
    if (!res.ok) throw new Error('Failed to save state');
    return res.json();
  }

  async function saveMatch<T>(match: T, cause: string) {
    const res = await fetch(`${API_URL}${path}/matches`, {
      method: 'POST',
      credentials,
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ ...(match as object), cause }),
    });
    if (res.status === 401) {
      clearToken();
      throw new Error('Unauthorized');
    }
    if (!res.ok) throw new Error('Failed to save match');
    return res.json();
  }

  async function removeMatch(date: string, cause: string) {
    const res = await fetch(`${API_URL}${path}/matches/remove`, {
      method: 'POST',
      credentials,
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ date, cause }),
    });
    if (res.status === 401) {
      clearToken();
      throw new Error('Unauthorized');
    }
    if (!res.ok) throw new Error('Failed to remove match');
    return res.json();
  }

  return { clearToken, hasToken, login, loadState, loadStats, loadMatches, saveState, saveMatch, removeMatch };
}
