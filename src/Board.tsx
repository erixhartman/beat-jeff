import { useEffect, useMemo, useState } from 'react'
import { useData, HCATS, PCATS, catLabel, norm, load, save, type BoardPlayer, type League, type Values } from './data.ts'

interface Pick { key: string; mine: boolean }
const KEY = 'beatjeff.board.2027'
const keyOf = (p: BoardPlayer) => `${p.g}:${p.name}`

// Normal CDF, for "chance he's still there at your next pick"
function phi(x: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp((-x * x) / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return x > 0 ? 1 - p : p
}
function chance(est: number, pick: number) {
  const sd = Math.max(5, est * 0.3)
  return 1 - phi((pick - est) / sd)
}

function reminder(round: number) {
  if (round <= 2) return 'Picks 12 and 13: two bats. Power and OPS first; an ace only if Skubal or Misiorowski is there at 13.'
  if (round <= 6) return 'Rounds 3–6: power and OPS bats, plus your first one or two control aces. No closers.'
  if (round <= 10) return 'Rounds 7–10: get to four trusted starters by the end of round 10. Favour healthy .800+ OPS bats over names.'
  if (round <= 16) return 'Rounds 11–16: upside bats. This is where Arozarena, Abrams and Stewart came from.'
  return 'Rounds 17–22: lottery-ticket starters and a cheap closer or two. Cut starters fast in April.'
}

export default function Board() {
  const b = useData<{ players: BoardPlayer[] }>('board.json')
  const lg = useData<League>('league.json')
  const v = useData<Values>('values.json')
  const yr = v?.mode === 'projections' ? '2027' : '2026'
  const [picks, setPicks] = useState<Pick[]>(() => load<Pick[]>(KEY, []))
  const [g, setG] = useState<'all' | 'B' | 'P'>('all')
  const [pos, setPos] = useState('All')
  const [q, setQ] = useState('')
  const [hideTaken, setHideTaken] = useState(true)
  const [sortBy, setSortBy] = useState<'est' | 'value' | 'chance'>('est')
  const [confirmReset, setConfirmReset] = useState(false)
  useEffect(() => save(KEY, picks), [picks])

  const taken = useMemo(() => new Map(picks.map((p, i) => [p.key, { ...p, at: i + 1 }])), [picks])
  const myPicks = lg?.myPicks ?? []
  const current = picks.length + 1
  const nextMine = myPicks.find(p => p >= current) ?? null
  const afterThat = nextMine ? myPicks.find(p => p > nextMine) ?? null : null
  const round = Math.ceil(current / 12)

  const rows = useMemo(() => {
    if (!b) return []
    let list = b.players
    if (g !== 'all') list = list.filter(p => p.g === g)
    if (pos !== 'All') list = list.filter(p => p.pos.includes(pos))
    if (q.trim()) { const n = norm(q.trim()); list = list.filter(p => norm(p.name).includes(n)) }
    if (hideTaken) list = list.filter(p => !taken.has(keyOf(p)) || taken.get(keyOf(p))!.mine)
    const target = nextMine === current ? afterThat : nextMine
    const withChance = list.map(p => ({ p, ch: target ? chance(p.est, target) : null }))
    const s = [...withChance]
    if (sortBy === 'value') s.sort((x, y) => (x.p.overall ?? 9999) - (y.p.overall ?? 9999))
    else if (sortBy === 'chance') s.sort((x, y) => (x.ch ?? 0) - (y.ch ?? 0))
    else s.sort((x, y) => x.p.est - y.p.est)
    return s.slice(0, 300)
  }, [b, g, pos, q, hideTaken, taken, sortBy, nextMine, afterThat, current])

  const mine = useMemo(() => {
    if (!b) return []
    const byKey = new Map(b.players.map(p => [keyOf(p), p]))
    return picks.filter(p => p.mine).map(p => byKey.get(p.key)).filter(Boolean) as BoardPlayer[]
  }, [b, picks])

  const profile = useMemo(() => {
    const out: Record<string, number> = {}
    for (const c of [...HCATS, ...PCATS]) out[c] = 0
    for (const p of mine) for (const [c, z] of Object.entries(p.z ?? {})) out[c] += z as number
    return out
  }, [mine])

  if (!b || !lg || !v) return <p>Loading the board…</p>

  const add = (p: BoardPlayer, isMine: boolean) => setPicks(ps => [...ps, { key: keyOf(p), mine: isMine }])
  const undo = () => setPicks(ps => ps.slice(0, -1))
  const reset = () => { if (confirmReset) { setPicks([]); setConfirmReset(false) } else setConfirmReset(true) }
  const target = nextMine === current ? afterThat : nextMine
  const counts = { H: mine.filter(p => p.g === 'B').length, SP: mine.filter(p => p.pos.includes('SP')).length, RP: mine.filter(p => p.pos.includes('RP') && !p.pos.includes('SP')).length }
  const maxAbs = Math.max(3, ...Object.values(profile).map(Math.abs))

  return (
    <section>
      <h2>Draft board</h2>
      <p className="lede">
        You pick 12th, so you go back to back at every turn. Mark each pick as it happens: <strong>Taken</strong> for anyone else, <strong>Mine</strong> for yours.
        The board estimates who'll still be there when you pick next. It saves in this browser only.
      </p>
      <div className="split">
        <div>
          <div className="controls">
            <div className="seg" role="group" aria-label="Group">
              {(['all', 'B', 'P'] as const).map(x => <button key={x} aria-pressed={g === x} onClick={() => { setG(x); setPos('All') }}>{x === 'all' ? 'All' : x === 'B' ? 'Hitters' : 'Pitchers'}</button>)}
            </div>
            <div className="seg" role="group" aria-label="Position">
              {(g === 'P' ? ['All', 'SP', 'RP'] : g === 'B' ? ['All', 'C', '1B', '2B', '3B', 'SS', 'OF'] : ['All', 'C', '1B', '2B', '3B', 'SS', 'OF', 'SP', 'RP']).map(x =>
                <button key={x} aria-pressed={pos === x} onClick={() => setPos(x)}>{x}</button>)}
            </div>
            <div className="seg" role="group" aria-label="Sort">
              <button aria-pressed={sortBy === 'est'} onClick={() => setSortBy('est')}>Expected order</button>
              <button aria-pressed={sortBy === 'value'} onClick={() => setSortBy('value')}>{yr} rank</button>
              <button aria-pressed={sortBy === 'chance'} onClick={() => setSortBy('chance')}>Gone soonest</button>
            </div>
            <input className="search" type="search" placeholder="Find a player" value={q} onChange={e => setQ(e.target.value)} aria-label="Find a player" />
            <label className="check"><input type="checkbox" checked={hideTaken} onChange={e => setHideTaken(e.target.checked)} /> Hide taken</label>
          </div>
          <div className="table-wrap" tabIndex={0}>
            <table className="stats">
              <thead>
                <tr>
                  <th title="Where he's expected to go in a 12-team draft">Expected pick</th><th className="l">Player</th><th className="l">Pos</th><th className="l">Team</th>
                  <th title="Rank on the Rankings tab, 1–500 across hitters and pitchers">{yr} rank</th>
                  <th title={target ? `Chance he's still available at pick ${target}` : ''}>{target ? `There at ${target}?` : 'There?'}</th>
                  <th className="l">Mark</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, ch }) => {
                  const t = taken.get(keyOf(p))
                  return (
                    <tr key={keyOf(p)} className={t ? (t.mine ? 'mine' : 'taken') : ''}>
                      <td className="dim" title={`Estimated from ${p.estFrom}`}>{p.est}</td>
                      <td className="l name">{p.name}</td>
                      <td className="l pos-chip">{p.pos.join(', ')}</td>
                      <td className="l dim">{p.team}</td>
                      <td className="val">{p.overall ?? '–'}</td>
                      <td className={ch == null ? 'dim' : ch < 0.35 ? 'z-neg' : ch > 0.75 ? 'z-pos' : ''}>{t ? `#${t.at}` : ch == null ? '–' : `${Math.round(ch * 100)}%`}</td>
                      <td className="l">
                        {t ? <span className="dim">{t.mine ? 'Yours' : 'Taken'}</span> : (
                          <>
                            <button className="btn small" onClick={() => add(p, false)}>Taken</button>{' '}
                            <button className="btn small primary" onClick={() => add(p, true)}>Mine</button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="note">
            Expected pick comes from the experts' 2027 rankings (NBC's top 150, then Pitcher List's order for starters, then 2026 value for everyone else).
            {yr} rank is this league's own scoring ({yr === '2027' ? 'of the 2027 projections' : 'of last season'}), so a big gap between the two is either a bargain or a warning: check why.
            The chance he's still there assumes picks land within about 30% of the expected slot. It's a rough guide, not a projection of this room.
          </p>
        </div>
        <aside className="side">
          <div className="panel">
            <h3>Pick {current > 264 ? 'done' : current} · round {Math.min(round, 22)}</h3>
            <dl className="kv">
              <dt>Your next pick</dt><dd>{nextMine ? `#${nextMine}${nextMine === current ? ' (you’re up)' : ` in ${nextMine - current} picks`}` : 'Draft over'}</dd>
              <dt>Then</dt><dd>{afterThat ? `#${afterThat}` : '–'}</dd>
            </dl>
            <ul className="picks" aria-label="Your picks">
              {myPicks.map(p => <li key={p} className={p < current ? 'done' : p === nextMine ? 'next' : ''}>{p}</li>)}
            </ul>
            <p className="mine-note" style={{ marginTop: 12 }}>{reminder(round)}</p>
            <div className="controls" style={{ marginTop: 10 }}>
              <button className="btn" onClick={undo} disabled={!picks.length}>Undo last pick</button>
              <button className="btn" onClick={reset} onBlur={() => setConfirmReset(false)}>{confirmReset ? 'Click again to clear' : 'Reset board'}</button>
            </div>
          </div>
          <div className="panel">
            <h3>Your team ({mine.length})</h3>
            <p className="note" style={{ margin: '0 0 6px' }}>{counts.H} hitters · {counts.SP} SP · {counts.RP} RP</p>
            {mine.length === 0 ? <p className="note">No picks yet.</p> : (
              <ol style={{ margin: 0, paddingLeft: 20, font: '500 15px/1.45 var(--font-table)' }}>
                {mine.map(p => <li key={keyOf(p)}>{p.name} <span className="dim">{p.pos.join(', ')}</span></li>)}
              </ol>
            )}
          </div>
          <div className="panel">
            <h3>Category profile</h3>
            <p className="note" style={{ margin: '0 0 8px' }}>Sum of your players' {yr} category scores. Watch for empty bars in OPS, runs and WHIP.</p>
            <table className="stats" style={{ fontSize: 14 }}>
              <tbody>
                {[...HCATS, ...PCATS].map(c => {
                  const z = profile[c]
                  const w = Math.round((Math.abs(z) / maxAbs) * 110)
                  return (
                    <tr key={c}>
                      <td className="l" style={{ width: 52 }}>{catLabel(c)}</td>
                      <td className="l"><span className={'cat-bar' + (z < 0 ? ' neg' : '')} style={{ width: w }} /></td>
                      <td>{z.toFixed(1)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </aside>
      </div>
    </section>
  )
}
