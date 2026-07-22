// @ts-nocheck
import React, { useCallback } from 'react';
import { saveState, loadMatches, saveMatch } from './api';
import { addPlayer, createGame, submitRoundScore, buildStateForSave } from './game-logic';
import { LoginScreen } from '../shared/AppShared';
import MainScreen from './components/MainScreen';
import GameSetup from './components/GameSetup';
import RoundScreen from './components/RoundScreen';
import GameEnd from './components/GameEnd';
import { AppShell, LoadingScreen, ModeSwitchButtons } from './components/AppShared';
import useKlask4Session from './hooks/useKlask4Session';

function resolveTeamScreen(state) {
  if (state.activeGame && state.activeGame.completed) return 'gameEnd';
  return state.activeGame && !state.activeGame.completed ? 'round' : 'main';
}

// Screens: loading, login, main, setup, round, gameEnd
export default function App() {
  const {
    screen,
    setScreen,
    players,
    setPlayers,
    games,
    setGames,
    activeGame,
    setActiveGame,
    extraFields,
    error,
    setError,
    saving,
    setSaving,
    handleLogin,
    handleLogout,
    stats,
  } = useKlask4Session(resolveTeamScreen);

  const [matches, setMatches] = React.useState([]);
  const [matchesPage, setMatchesPage] = React.useState(0);
  const [hasMoreMatches, setHasMoreMatches] = React.useState(true);
  const [loadingMatches, setLoadingMatches] = React.useState(false);
  const [serverStats, setServerStats] = React.useState(null);

  React.useEffect(() => {
    if (stats) setServerStats(stats);
  }, [stats]);

  const loadMoreMatches = useCallback(async (pageNum) => {
    setLoadingMatches(true);
    try {
      const data = await loadMatches(pageNum, 100);
      setHasMoreMatches((pageNum + 1) * data.limit < data.total);
      if (pageNum === 0) {
        setMatches(data.matches);
      } else {
        setMatches(prev => [...prev, ...data.matches]);
      }
      setMatchesPage(pageNum);
    } catch (err) {
      console.error('Failed to load matches', err);
    } finally {
      setLoadingMatches(false);
    }
  }, []);

  React.useEffect(() => {
    if (screen === 'main') {
      loadMoreMatches(0);
    }
  }, [screen, loadMoreMatches]);

  const persist = useCallback(async (newPlayers, newGames, newActiveGame, cause) => {
    setSaving(true);
    try {
      const state = buildStateForSave(newPlayers, newGames, newActiveGame, extraFields);
      const result = await saveState(state, cause);
      if (result.stats) setServerStats(result.stats);
    } catch (err) {
      setError(err.message);
      if (err.message === 'Unauthorized') {
        setScreen('login');
      }
    } finally {
      setSaving(false);
    }
  }, [extraFields, setError, setSaving, setScreen]);

  async function handleAddPlayer(name) {
    const { newPlayers } = addPlayer(players, name);
    setPlayers(newPlayers);
    await persist(newPlayers, games, activeGame, `Add player: ${name}`);
  }

  function handleStartSetup() {
    if (activeGame && !activeGame.completed) {
      if (!window.confirm('There is an active game in progress. Abandon it and start a new one?')) {
        return;
      }
    }
    setScreen('setup');
  }

  async function handleStartGame(playerIds) {
    const game = createGame(playerIds);
    setActiveGame(game);
    setScreen('round');
    await persist(players, games, game, 'Start new game');
  }

  async function handleSubmitScore(score1, score2) {
    const updated = submitRoundScore(activeGame, score1, score2);
    const roundIdx = activeGame.currentRound;
    if (!updated.completed) {
      setActiveGame(updated);
      setScreen('round');
      await persist(players, games, updated, `Submit round ${roundIdx + 1} score: ${score1}-${score2}`);
      return;
    }
    setActiveGame(updated);
    setScreen('gameEnd');
    await persist(players, games, updated, `Submit round ${roundIdx + 1} score: ${score1}-${score2}`);
  }

  async function handleCancelGame() {
    if (!window.confirm('Cancel the current game?')) return;
    setActiveGame(null);
    setScreen('main');
    await persist(players, games, null, 'Cancel game');
  }

  async function handleFinishGame() {
    if (!activeGame || !activeGame.completed) return;
    const completedGame = {
      date: new Date().toISOString(),
      playerIds: [...activeGame.playerIds],
      rounds: activeGame.rounds.map((r) => ({
        team1: [...r.team1],
        team2: [...r.team2],
        score1: r.score1,
        score2: r.score2,
      })),
    };
    setSaving(true);
    try {
      const result = await saveMatch(completedGame, 'Complete game');
      setServerStats(result.stats);
      setActiveGame(null);
      setScreen('main');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (screen === 'loading') {
    return <LoadingScreen />;
  }

  if (screen === 'login') {
    return (
      <>
        <ModeSwitchButtons rightMode="solo" rightLabel="Solo Mode" />
        <LoginScreen title="🎮 Klask 4" onLogin={handleLogin} />
      </>
    );
  }

  return (
    <AppShell
      rightMode="solo"
      rightLabel="Solo Mode"
      showModeSwitch={screen === 'main'}
      saving={saving}
      error={error}
      onDismissError={() => setError(null)}
    >
      {screen === 'main' && (
        <MainScreen
          players={players}
          games={matches}
          stats={serverStats}
          onStartSetup={handleStartSetup}
          onLogout={handleLogout}
          onLoadMore={() => loadMoreMatches(matchesPage + 1)}
          hasMore={hasMoreMatches}
          loading={loadingMatches}
        />
      )}

      {screen === 'setup' && (
        <GameSetup
          players={players}
          onStartGame={handleStartGame}
          onAddPlayer={handleAddPlayer}
          onCancel={() => setScreen('main')}
        />
      )}

      {screen === 'round' && activeGame && !activeGame.completed && (
        <RoundScreen
          game={activeGame}
          players={players}
          onSubmitScore={handleSubmitScore}
          onCancel={handleCancelGame}
        />
      )}

      {screen === 'gameEnd' && activeGame && (
        <GameEnd
          game={activeGame}
          players={players}
          onFinish={handleFinishGame}
        />
      )}
    </AppShell>
  );
}
