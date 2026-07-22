import { createStateClient } from '../shared/api';
import { AUTH_TOKEN_KEY } from '../shared/auth';

export const klask4Api = createStateClient({
  path: '/klask4/state',
  tokenKey: AUTH_TOKEN_KEY,
});

export const { clearToken, hasToken, login, loadState, loadStats, loadMatches, saveState, saveMatch, removeMatch } = klask4Api;
