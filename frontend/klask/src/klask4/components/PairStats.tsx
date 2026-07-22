import React from 'react';
import { calculatePairStats } from '../game-logic';
import SortableTable from '../../shared/SortableTable';

export default function PairStats({ players, games, stats: serverStats }) {
  const stats: any[] = serverStats || calculatePairStats(players, games);

  if (stats.length === 0 || stats.every(s => s.roundsPlayed === 0)) {
    return (
      <section>
        <h2>Pair Stats</h2>
        <p className="empty-text">No completed games yet.</p>
      </section>
    );
  }

  const bestWinPct = stats[0].winPercent;

  return (
    <section>
      <h2>Pair Stats</h2>
      <SortableTable<any>
        columns={[
          { key: 'rank', label: '#', value: (_row, index) => index + 1 },
          { key: 'pair', label: 'Pair', value: (row) => row.names.join(' & '), render: (row) => row.names.join(' & ') },
          { key: 'rounds', label: 'Win/Total', value: (row) => row.roundsWon / Math.max(row.roundsPlayed, 1), defaultDirection: 'desc', render: (row) => `${row.roundsWon}/${row.roundsPlayed}` },
          { key: 'winPercent', label: 'Win %', value: (row) => row.winPercent, defaultDirection: 'desc', render: (row) => `${row.winPercent}%` },
          { key: 'avgScore', label: 'Avg Score', value: (row) => row.avgScore, defaultDirection: 'desc' },
        ]}
        rows={stats}
        rowKey={(row) => row.pair.join('-')}
        defaultSort={{ key: 'winPercent', direction: 'desc' }}
        getRowClassName={(row) => (row.winPercent === bestWinPct ? 'best-pair' : undefined)}
      />
    </section>
  );
}
