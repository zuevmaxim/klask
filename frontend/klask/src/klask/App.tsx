import React from 'react';
import { AppShell, LoadingScreen, LoginScreen } from '../shared/AppShared';
import SortableTable, { type Column } from '../shared/SortableTable';
import AddPlayerForm from '../shared/AddPlayerForm';
import ScorePicker from '../shared/ScorePicker';
import { getModeHref } from '../shared/navigation';
import { klaskApi, loadMatches, saveMatch } from './api';
import { useStateSession } from '../shared/session';
import {
  addPlayerToState,
  championship,
  championshipHistory,
  getStateForSave,
  loadStateFromData,
  players,
  removeChampionshipEventFromHistory,
  setChampion,
} from './game-logic';

type Screen = 'login' | 'main';
type AnyRow = Record<string, any>;
type KlaskServerStats = {
  playerStats: AnyRow[];
  headToHead: Record<string, AnyRow[]>;
  championshipDurations: Record<string, number>;
};
function resolveMainScreen(): Screen { return 'main'; }
function Notification({ notification }: { notification: { message: string; type: string } | null }) {
  return <div id="notification" className={`notification ${notification?.type || ''} ${notification ? 'show' : ''}`}>{notification?.message}</div>;
}

function History({ events, championshipDurations, onRemove, onLoadMore, hasMore, loading }: { events: AnyRow[]; championshipDurations: Record<string, number>; onRemove: (type: 'game' | 'championship', index: number) => void; onLoadMore: () => void; hasMore: boolean; loading: boolean }) {
  if (events.length === 0) return <p>No games played yet</p>;
  return <>
    <ul>{events.map((event: AnyRow, idx: number) => {
      const date = new Date(event.date);
      const prefix = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - `;
      if (event.type === 'game') {
        const p1 = players.find((p: AnyRow) => p.id === event.player1Id);
        const p2 = players.find((p: AnyRow) => p.id === event.player2Id);
        const winnerName = event.score1 > event.score2 ? p1?.name : p2?.name;
        const loserName = event.score1 > event.score2 ? p2?.name : p1?.name;
        const winnerDelta = event.score1 > event.score2 ? event.rating?.player1Delta : event.rating?.player2Delta;
        const loserDelta = event.score1 > event.score2 ? event.rating?.player2Delta : event.rating?.player1Delta;
        const ratingText = typeof winnerDelta === 'number' && typeof loserDelta === 'number' ? ` · rating ${winnerDelta > 0 ? '+' : ''}${winnerDelta}/${loserDelta}` : '';
        return <li className="history-item" key={`${event.type}-${event.date}-${idx}`}><span>{prefix}{winnerName || 'Unknown'} {Math.max(event.score1, event.score2)}:{Math.min(event.score1, event.score2)} {loserName || 'Unknown'}{ratingText}</span><button className="remove-event-btn circular-btn circular-btn-sm hover-scale-rotate" onClick={() => onRemove('game', event.originalIndex)}>×</button></li>;
      }
      const newChamp = players.find((p: AnyRow) => p.id === event.newChampionId);
      const prevChamp = players.find((p: AnyRow) => p.id === event.previousChampionId);
      let durationText = '';
      if (event.previousChampionId) {
        const previousEvent = events.slice(idx + 1).find((candidate) => candidate.type === 'championship' && candidate.newChampionId === event.previousChampionId);
        if (previousEvent && typeof championshipDurations[previousEvent.date] === 'number') {
          const days = championshipDurations[previousEvent.date];
          durationText = days === 0 ? ' - held for <1 day' : ` - held for ${days} ${days === 1 ? 'day' : 'days'}`;
        }
      }
      return <li className="history-item" key={`${event.type}-${event.date}-${idx}`}><span><strong>{prefix}👑 {newChamp?.name || 'None'} became champion {event.reason === 'manual' ? '(manual)' : ''}</strong> (was: {prevChamp?.name || 'None'}{durationText})</span><button className="remove-event-btn circular-btn circular-btn-sm hover-scale-rotate" onClick={() => onRemove('championship', event.originalIndex)}>×</button></li>;
    })}</ul>
    {hasMore && <button className="load-more-btn" onClick={onLoadMore} disabled={loading}>{loading ? 'Loading...' : 'Load more'}</button>}
  </>;
}

export default function App() {
  const [, forceRender] = React.useReducer((x) => x + 1, 0);
  const [score1, setScore1] = React.useState<number | null>(null);
  const [score2, setScore2] = React.useState<number | null>(null);
  const [showAddPlayer, setShowAddPlayer] = React.useState(false);
  const [showChampion, setShowChampion] = React.useState(false);
  const [selectedChampion, setSelectedChampion] = React.useState<string>('');
  const [p1Id, setP1Id] = React.useState('');
  const [p2Id, setP2Id] = React.useState('');
  const [notification, setNotification] = React.useState<{ message: string; type: string } | null>(null);
  const [h2hPlayerId, setH2hPlayerId] = React.useState<number | null>(null);

  const [serverStats, setServerStats] = React.useState<KlaskServerStats | null>(null);
  const [matches, setMatches] = React.useState<any[]>([]);
  const [matchesPage, setMatchesPage] = React.useState(0);
  const [hasMoreMatches, setHasMoreMatches] = React.useState(true);
  const [loadingMatches, setLoadingMatches] = React.useState(false);

  const refreshDefaults = React.useCallback(() => {
    if (players.length >= 2) {
      const champ = players.find((p: AnyRow) => p.id === championship.championId);
      const first = String(champ?.id || players[0].id);
      const second = String((players.find((p: AnyRow) => String(p.id) !== first) || players[0]).id);
      setP1Id((current) => current || first);
      setP2Id((current) => current || second);
    }
    setSelectedChampion(championship.championId ? String(championship.championId) : '');
  }, []);

  const deserialize = React.useCallback((raw: any) => {
    loadStateFromData(raw);
    setServerStats(raw.stats || null);
    refreshDefaults();
    forceRender();
    return getStateForSave();
  }, [refreshDefaults]);

  const { screen, setScreen, error, setError, saving, setSaving, handleLogin, handleLogout } = useStateSession({
    client: klaskApi,
    deserialize,
    resolveScreen: resolveMainScreen,
    loginScreen: 'login' as Screen,
  });

  const loadMoreMatches = React.useCallback(async (pageNum: number) => {
    setLoadingMatches(true);
    try {
      const data: any = await loadMatches(pageNum, 100);
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

  async function persist(cause: string) {
    setSaving(true);
    try {
      const result: any = await klaskApi.saveState(getStateForSave(), cause);
      setServerStats(result.stats || null);
      return result;
    }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to save. Please check your connection.'); if (err instanceof Error && err.message === 'Unauthorized') setScreen('login'); }
    finally { setSaving(false); }
  }
  async function loginAndRefresh(username: string, password: string) { await handleLogin(username, password); }
  function logout() { if (!confirm('Are you sure you want to logout?')) return; handleLogout(); }
  function selectPlayer(changed: 1 | 2, value: string) { const other = changed === 1 ? p2Id : p1Id; if (value === other) { const replacement = players.find((p: AnyRow) => String(p.id) !== value); if (changed === 1) setP2Id(String(replacement?.id || '')); else setP1Id(String(replacement?.id || '')); } changed === 1 ? setP1Id(value) : setP2Id(value); }
  function selectScore(player: 1 | 2, value: number) { if (player === 1) { setScore1(value); if (value < 6 && score2 !== 6) setScore2(6); } else { setScore2(value); if (value < 6 && score1 !== 6) setScore1(6); } }
  async function addPlayer(name: string) { addPlayerToState(name); setShowAddPlayer(false); refreshDefaults(); forceRender(); await persist('New player'); }

  async function addMatch() {
    if (players.length < 2 || score1 === null || score2 === null) return;
    const a = Number(p1Id);
    const b = Number(p2Id);
    if (a === b) return alert('A player cannot play against themselves');
    if (score1 !== 6 && score2 !== 6) return alert('One player must have 6 points');
    if (score1 === score2) return alert('Scores cannot be equal');
    
    setSaving(true);
    try {
      const result: any = await saveMatch({ player1Id: a, player2Id: b, score1, score2 }, 'New game');
      loadStateFromData(result.state);
      setServerStats(result.stats || null);
      await loadMoreMatches(0);
      setScore1(null);
      setScore2(null);
      setSelectedChampion(championship.championId ? String(championship.championId) : '');
      forceRender();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save match');
    } finally {
      setSaving(false);
    }
  }
  async function changeChampion() { setChampion(selectedChampion ? Number(selectedChampion) : null); setShowChampion(false); forceRender(); await persist('New champion'); }
  async function removeEvent(type: 'game' | 'championship', index: number) {
    if (!confirm('Remove this event?')) return;
    
    if (type === 'game') {
      const allEvents = [...championshipHistory.map((e: AnyRow, idx: number) => ({ ...e, type: 'championship', originalIndex: idx })), ...matches.map((m, idx) => ({ ...m, type: 'game', originalIndex: idx }))].sort((a: AnyRow, b: AnyRow) => +new Date(b.date) - +new Date(a.date));
      const eventToRemove = allEvents.find(e => e.type === 'game' && e.originalIndex === index);
      if (!eventToRemove) return;
      
      setSaving(true);
      try {
        const result: any = await klaskApi.removeMatch(eventToRemove.date, 'Remove history event');
        setServerStats(result.stats || null);
        await loadMoreMatches(0);
        forceRender();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove match');
      } finally {
        setSaving(false);
      }
    } else {
      removeChampionshipEventFromHistory(index);
      forceRender();
      await persist('Remove history event');
    }
  }

  if (screen === 'loading') return <LoadingScreen />;
  if (screen === 'login') return <><a className="switch-to-klask4-btn switch-app-btn switch-app-btn-top-left" href={getModeHref(window.location.pathname, 'team')}>Klask-4</a><LoginScreen title="🎮 Klask" onLogin={loginAndRefresh} /></>;

  const stats = serverStats?.playerStats || [];
  const champ = players.find((p: AnyRow) => p.id === championship.championId);
  const h2hPlayer = players.find((p: AnyRow) => p.id === h2hPlayerId);
  const h2hRows = h2hPlayerId ? serverStats?.headToHead[String(h2hPlayerId)] || [] : [];
  const statsColumns: Column<AnyRow>[] = [
    { key: 'name', label: 'Player' }, { key: 'rating', label: 'Rating', defaultDirection: 'desc' }, { key: 'winPercent', label: 'Win %', defaultDirection: 'desc', sortValue: (r) => Number(r.winPercent) }, { key: 'totalGames', label: 'Games', defaultDirection: 'desc' }, { key: 'pointPercent', label: 'Points %', defaultDirection: 'desc', sortValue: (r) => Number(r.pointPercent) }, { key: 'totalChampionDays', label: 'Champion Days', defaultDirection: 'desc' }, { key: 'maxChampionStreak', label: 'Max Streak', defaultDirection: 'desc' },
  ];
  const h2hColumns: Column<AnyRow>[] = [{ key: 'name', label: 'Opponent' }, { key: 'gamesAgainst', label: 'Games', defaultDirection: 'desc' }, { key: 'winBalance', label: 'Win Balance', defaultDirection: 'desc', render: (r) => `${r.winBalance > 0 ? '+' : ''}${r.winBalance}` }, { key: 'avgPointDiff', label: 'Avg Point Diff', defaultDirection: 'desc', sortValue: (r) => Number(r.avgPointDiff), render: (r) => `${Number(r.avgPointDiff) > 0 ? '+' : ''}${r.avgPointDiff}` }];

  return <AppShell rightMode="team" rightLabel="Klask-4" showModeSwitch={false} saving={saving} error={error} onDismissError={() => setError(null)}>
    <a className="switch-to-klask4-btn switch-app-btn switch-app-btn-top-left" href={getModeHref(window.location.pathname, 'team')}>Klask-4</a>
    <Notification notification={notification} />
    <div id="h2hModal" className={`h2h-modal${h2hPlayerId ? ' show' : ''}`} onClick={() => setH2hPlayerId(null)}><div className="h2h-modal-content" onClick={(e) => e.stopPropagation()}><div className="h2h-modal-header"><h2>{h2hPlayer ? `${h2hPlayer.name}'s statistics` : 'Head to Head'}</h2><button className="h2h-close-btn circular-btn circular-btn-md hover-scale-rotate" onClick={() => setH2hPlayerId(null)}>×</button></div>{h2hPlayerId && (h2hRows.length ? <SortableTable columns={h2hColumns} rows={h2hRows} className="data-table h2h-table" defaultSort={{ key: 'gamesAgainst', direction: 'desc' }} /> : <p style={{ color: '#111111', textAlign: 'center' }}>No games played against other players yet.</p>)}</div></div>
    <button className="icon-btn add-player-btn circular-btn" onClick={() => setShowAddPlayer((v) => !v)}>+</button><button className="icon-btn logout-btn circular-btn" onClick={logout}>⎋</button>
    {showAddPlayer && <AddPlayerForm onAddPlayer={addPlayer} />}
    <hr /><h2>🎮 New game</h2>
    <select id="p1" value={p1Id} onChange={(e) => selectPlayer(1, e.target.value)}>{players.map((p: AnyRow) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><div><div className="score-label">Score player 1</div><ScorePicker max={6} value={score1} onSelect={(v) => selectScore(1, v)} /></div>
    <select id="p2" value={p2Id} onChange={(e) => selectPlayer(2, e.target.value)}>{players.map((p: AnyRow) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><div><div className="score-label">Score player 2</div><ScorePicker max={6} value={score2} onSelect={(v) => selectScore(2, v)} /></div><button onClick={addMatch}>Save game</button>
    <hr /><h2>👑 Champion</h2><div className="champion-section"><div id="champion">{champ ? champ.name : 'No champion'}</div><button className="change-champion-btn circular-btn circular-btn-md hover-scale" onClick={() => setShowChampion((v) => !v)}>✎</button></div>{showChampion && <div className="add-player-form"><select value={selectedChampion} onChange={(e) => setSelectedChampion(e.target.value)}><option value="">No champion</option>{players.map((p: AnyRow) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><button onClick={changeChampion}>Set</button></div>}
    <hr /><h2>📊 Stats</h2><div id="stats">{stats.length ? <SortableTable columns={statsColumns} rows={stats} defaultSort={{ key: 'rating', direction: 'desc' }} onRowClick={(row) => setH2hPlayerId(players.find((p: AnyRow) => p.name === row.name)?.id || null)} /> : <p>No statistics yet</p>}</div>
    <hr /><h2>📜 Game History</h2><div id="gameHistory"><History
      events={[...championshipHistory.map((e: AnyRow, idx: number) => ({ ...e, type: 'championship', originalIndex: idx })), ...matches.map((m, idx) => ({ ...m, type: 'game', originalIndex: idx }))].sort((a: AnyRow, b: AnyRow) => +new Date(b.date) - +new Date(a.date))}
      championshipDurations={serverStats?.championshipDurations || {}}
      onRemove={removeEvent}
      onLoadMore={() => loadMoreMatches(matchesPage + 1)}
      hasMore={hasMoreMatches}
      loading={loadingMatches}
    /></div>
  </AppShell>;
}
