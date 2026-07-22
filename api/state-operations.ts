export function normalizeState(initialState: any, data: any) {
    const source = data || initialState;
    return {
        ...initialState,
        ...source,
        games: Array.isArray(source.games) ? source.games : []
    };
}

export function stateForClient(state: any, stats: unknown) {
    const { games, stats: _storedStats, ...rest } = state;
    return { ...rest, stats };
}

function parseNonNegativeInteger(value: unknown, fallback: number) {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function paginateGames(state: any, pageValue: unknown, limitValue: unknown) {
    const page = parseNonNegativeInteger(pageValue, 0);
    const limit = Math.min(500, Math.max(1, parseNonNegativeInteger(limitValue, 100)));
    const allGames = Array.isArray(state.games) ? state.games : [];
    const matches = [...allGames].sort((a: any, b: any) => +new Date(b.date) - +new Date(a.date));
    const start = page * limit;

    return {
        matches: matches.slice(start, start + limit),
        total: matches.length,
        page,
        limit
    };
}

export function removeGameByDate(state: any, date: string) {
    const games = Array.isArray(state.games) ? [...state.games] : [];
    const index = games.findIndex((game: any) => game.date === date);
    if (index < 0) return { state, removed: false };

    games.splice(index, 1);
    return {
        state: { ...state, games },
        removed: true
    };
}
