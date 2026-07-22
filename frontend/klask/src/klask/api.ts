import { createStateClient } from '../shared/api';
import { AUTH_TOKEN_KEY } from '../shared/auth';

export const klaskApi = createStateClient({
  path: '/state',
  tokenKey: AUTH_TOKEN_KEY,
  credentials: 'include',
});

export const { clearToken, hasToken, login, loadState, loadStats, loadMatches, saveState, saveMatch, removeMatch } = klaskApi;
