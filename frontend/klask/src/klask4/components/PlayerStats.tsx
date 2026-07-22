import React from 'react';
import { calculatePlayerStats } from '../game-logic';
import SortableTable from '../../shared/SortableTable';

export default function PlayerStats({ players, games, stats: serverStats }) {
  const stats: any[] = serverStats || calculatePlayerStats(players, games);

  if (stats.length === 0 || stats.every(s => s.roundsPlayed === 0)) {
    return (
      <section>
        <h2>Player Stats</h2>
        <p className="empty-text">No completed games yet.</p>
      </section>
    );
  }

  return (
    <section>
      <h2>Player Stats</h2>
      <SortableTable<any>
        columns={[
          { key: 'rank', label: '#', value: (_row, index) => index + 1 },
          { key: 'name', label: 'Player', value: (row) => row.name },
          { key: 'rounds', label: 'Win/Total', value: (row) => row.roundsWon / Math.max(row.roundsPlayed, 1), defaultDirection: 'desc', render: (row) => `${row.roundsWon}/${row.roundsPlayed}` },
          { key: 'winPercent', label: 'Win %', value: (row) => row.winPercent, defaultDirection: 'desc', render: (row) => `${row.winPercent}%` },
        ]}
        rows={stats}
        rowKey={(row) => row.playerId}
        defaultSort={{ key: 'winPercent', direction: 'desc' }}
      />
    </section>
  );
}
