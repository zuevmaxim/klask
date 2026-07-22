import React from 'react';
import PlayerStats from './PlayerStats';
import PairStats from './PairStats';
import GameHistory from './GameHistory';

export default function MainScreen({ players, games, stats, onStartSetup, onLogout, onLoadMore, hasMore, loading }) {
  const canStartGame = players.length >= 4;

  return (
    <div className="main-screen">
      <button
        className="icon-btn logout-btn circular-btn"
        onClick={onLogout}
        title="Logout"
        aria-label="Logout"
      >
        ⎋
      </button>

      <div className="top-bar">
        <h1>🎮 Klask 4</h1>
      </div>

      <div className="start-game-section">
        <button
          onClick={onStartSetup}
          disabled={!canStartGame}
          className="btn-start-game"
        >
          Start New Game
        </button>
        {!canStartGame && (
          <p className="hint-text">Add at least 4 players to start a game</p>
        )}
      </div>

      <PlayerStats players={players} games={games} stats={stats?.playerStats} />
      <PairStats players={players} games={games} stats={stats?.pairStats} />
      <GameHistory games={games} players={players} onLoadMore={onLoadMore} hasMore={hasMore} loading={loading} />
    </div>
  );
}
