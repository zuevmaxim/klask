// @ts-nocheck
import React from 'react';

export default function GameHistory({ games, players, onLoadMore, hasMore, loading }) {
  const playerMap = Object.fromEntries(players.map(p => [p.id, p.name]));
  function getWinners(game) {
    const winsByPlayer = new Map(game.playerIds.map((id) => [id, 0]));
    for (const round of game.rounds) {
      if (round.score1 === null || round.score2 === null || round.score1 === round.score2) continue;
      const winners = round.score1 > round.score2 ? round.team1 : round.team2;
      for (const id of winners) {
        winsByPlayer.set(id, (winsByPlayer.get(id) || 0) + 1);
      }
    }
    const maxWins = Math.max(...winsByPlayer.values());
    return {
      names: game.playerIds
        .filter((id) => (winsByPlayer.get(id) || 0) === maxWins)
        .map((id) => playerMap[id] || `#${id}`),
      wins: maxWins,
    };
  }

  if (games.length === 0) {
    return (
      <section>
        <h2>Game History</h2>
        <p className="empty-text">No completed games yet.</p>
      </section>
    );
  }

  return (
    <section>
      <h2>Game History</h2>
      <div className="history-list">
        {games.map((game, gi) => {
          const winner = getWinners(game);
          return (
            <div key={`${game.date}-${gi}`} className="history-item">
            <div className="history-header">
              <span className="history-date">
                {new Date(game.date).toLocaleDateString()} {new Date(game.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="history-winner">
                {winner.names.join(', ')} won ({winner.wins})
              </span>
            </div>
            <div className="history-rounds">
              {game.rounds.map((r, ri) => (
                <div key={ri} className="history-round">
                  <span className={r.score1 > r.score2 ? 'winner' : ''}>
                    {r.team1.map(id => playerMap[id] || `#${id}`).join(' & ')}
                  </span>
                  <span className="history-score">{r.score1}-{r.score2}</span>
                  <span className={r.score2 > r.score1 ? 'winner' : ''}>
                    {r.team2.map(id => playerMap[id] || `#${id}`).join(' & ')}
                  </span>
                </div>
              ))}
            </div>
            </div>
          );
        })}
      </div>
      {hasMore && <button className="load-more-btn" onClick={onLoadMore} disabled={loading}>{loading ? 'Loading...' : 'Load more'}</button>}
    </section>
  );
}
