import { klask4Api } from '../api';
import { loadStateFromData } from '../game-logic';
import { useStateSession } from '../../shared/session';

export default function useKlask4Session(resolveScreen) {
  const session = useStateSession({
    client: klask4Api,
    deserialize: loadStateFromData,
    resolveScreen,
    loginScreen: 'login',
  });

  const state = session.state || { players: [], games: [], activeGame: null, extraFields: {}, stats: null };

  return {
    ...session,
    players: state.players,
    setPlayers: (players) => session.setState((current) => ({ ...(current || state), players })),
    games: state.games,
    setGames: (games) => session.setState((current) => ({ ...(current || state), games })),
    activeGame: state.activeGame,
    setActiveGame: (activeGame) => session.setState((current) => ({ ...(current || state), activeGame })),
    extraFields: state.extraFields || {},
    setExtraFields: (extraFields) => session.setState((current) => ({ ...(current || state), extraFields })),
    stats: state.stats,
  };
}
