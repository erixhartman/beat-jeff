import { useMemo, useState } from 'react'
import { useData, HCATS, PCATS, catLabel, fmt2, fmt3, norm, type Values, type Hitter, type Pitcher, type Cat } from './data.ts'

type Group = 'B' | 'P'
type Row = Hitter | Pitcher
type Col = { key: string; label: string; get: (r: Row) => number | string | null; fmt?: (v: number) => string; asc?: boolean; cat?: Cat; cls?: string }

const HPOS = ['All', 'C', '1B', '2B', '3B', 'SS', 'OF', 'Util']
const PPOS = ['All', 'SP', 'RP']

export default function Rankings() {
  const v = useData<Values>('values.json')
  const [g, setG] = useState<Group>('B')
  const [pos, setPos] = useState('All')
  const [mode, setMode] = useState<'stats' | 'values'>('stats')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<{ key: string; asc: boolean }>({ key: 'overall', asc: true })

  const cols: Col[] = useMemo(() => {
    const cats = (g === 'B' ? HCATS : PCATS) as readonly Cat[]
    const lowGood = new Set(['ERA', 'WHIP'])
    const statCols: Col[] = mode === 'stats'
      ? cats.map(c => ({
          key: c, label: catLabel(c), cat: c, asc: lowGood.has(c),
          get: (r: Row) => (r as unknown as Record<string, number>)[c],
          fmt: c === 'AVG' || c === 'OPS' ? fmt3 : c === 'ERA' || c === 'WHIP' || c === 'KBB' ? fmt2 : undefined,
        }))
      : cats.map(c => ({ key: 'z' + c, label: catLabel(c), cat: c, get: (r: Row) => r.z[c] ?? 0, fmt: (n: number) => (n > 0 ? '+' : '') + n.toFixed(1), cls: 'zc' }))
    const vol: Col = g === 'B'
      ? { key: 'ab', label: 'AB', get: r => (r as Hitter).ab }
      : { key: 'ip', label: 'IP', get: r => (r as Pitcher).ip, fmt: n => n.toFixed(0) }
    return [
      { key: 'overall', label: 'Rank', get: r => r.overall, asc: true },
      vol,
      ...statCols,
      { key: 'var', label: 'Value', get: r => r.var, fmt: n => n.toFixed(1), cls: 'val' },
      { key: 'equalRank', label: 'Std rk', get: r => r.equalRank, asc: true, cls: 'dim' },
      { key: 'yahoo', label: 'Yahoo', get: r => r.yahoo, asc: true, cls: 'dim' },
      { key: 'nbc', label: 'NBC 27', get: r => r.nbc, asc: true, cls: 'dim' },
      ...(g === 'P' ? [{ key: 'pl', label: 'PL SP 27', get: (r: Row) => (r as Pitcher).pl, asc: true, cls: 'dim' } as Col] : []),
    ]
  }, [g, mode])

  const rows = useMemo(() => {
    if (!v) return []
    let list: Row[] = g === 'B' ? v.hitters : v.pitchers
    if (pos !== 'All') list = list.filter(r => r.pos.includes(pos))
    if (q.trim()) { const n = norm(q.trim()); list = list.filter(r => norm(r.name).includes(n) || norm(r.team).includes(n)) }
    const col = cols.find(c => c.key === sort.key) ?? cols[0]
    return [...list].sort((a, b) => {
      const x = col.get(a), y = col.get(b)
      if (x == null && y == null) return 0
      if (x == null) return 1
      if (y == null) return -1
      const d = (x as number) - (y as number)
      return sort.asc ? d : -d
    })
  }, [v, g, pos, q, sort, cols])

  if (!v) return <p>Loading rankings…</p>

  const clickSort = (c: Col) => setSort(s => (s.key === c.key ? { key: c.key, asc: !s.asc } : { key: c.key, asc: c.asc ?? false }))
  const switchGroup = (ng: Group) => { setG(ng); setPos('All'); setSort({ key: 'overall', asc: true }) }

  return (
    <section>
      {v.mode === 'projections' ? (
        <>
          <h2>2027 rankings, scored for this league</h2>
          <p className="lede">
            {v.asOf}, scored on our 12 categories with each category weighted by how much it decided matchups here from 2023 to 2026.
            OPS and WHIP count most, saves least. The Yahoo column is last season's final rank, for comparison.
          </p>
        </>
      ) : (
        <>
          <h2>2026 rankings, scored for this league</h2>
          <p className="lede">
            Every 2026 player re-scored on our 12 categories, with each category weighted by how much it decided matchups here
            from 2023 to 2026. OPS and WHIP count most, saves least. This is last season's value, not a 2027 projection: the NBC and
            Pitcher List columns show where the experts have each player for 2027.
          </p>
        </>
      )}
      <div className="controls">
        <div className="seg" role="group" aria-label="Player group">
          <button aria-pressed={g === 'B'} onClick={() => switchGroup('B')}>Hitters</button>
          <button aria-pressed={g === 'P'} onClick={() => switchGroup('P')}>Pitchers</button>
        </div>
        <div className="seg" role="group" aria-label="Position">
          {(g === 'B' ? HPOS : PPOS).map(p => <button key={p} aria-pressed={pos === p} onClick={() => setPos(p)}>{p}</button>)}
        </div>
        <div className="seg" role="group" aria-label="Show">
          <button aria-pressed={mode === 'stats'} onClick={() => setMode('stats')}>Stats</button>
          <button aria-pressed={mode === 'values'} onClick={() => setMode('values')}>Category value</button>
        </div>
        <input className="search" type="search" placeholder="Search player or team" value={q} onChange={e => setQ(e.target.value)} aria-label="Search players" />
      </div>
      <div className="table-wrap" tabIndex={0}>
        <table className="stats">
          <thead>
            <tr>
              <th className="l">Player</th>
              <th className="l">Pos</th>
              <th className="l">Team</th>
              {cols.map(c => (
                <th key={c.key} className="sortable" scope="col"
                    aria-sort={sort.key === c.key ? (sort.asc ? 'ascending' : 'descending') : undefined}>
                  <button type="button" onClick={() => clickSort(c)} title={c.cat ? `Weight ${v.weights[c.cat]} in this league` : `Sort by ${c.label}`}>
                    {c.label}
                    {c.cat && <span className="wt">×{v.weights[c.cat].toFixed(2)}</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id ?? r.name}>
                <td className="l name">{r.name}{r.small && <span className="small-flag" title="Small 2026 sample">small sample</span>}</td>
                <td className="l pos-chip">{r.pos.join(', ')}</td>
                <td className="l dim">{r.team}</td>
                {cols.map(c => {
                  const val = c.get(r)
                  const zc = c.cls === 'zc' && typeof val === 'number' ? (val >= 0.5 ? 'z-pos' : val <= -0.5 ? 'z-neg' : '') : ''
                  return <td key={c.key} className={[c.cls === 'zc' ? zc : c.cls ?? ''].join(' ')}>{val == null ? '–' : c.fmt && typeof val === 'number' ? c.fmt(val) : val}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">
        Rank runs 1–500 across hitters and pitchers together. Value = sum of category scores × weight, measured above a replacement-level player
        (the 156th-best hitter or 108th-best pitcher, about what 12 teams roster), so a hitter's and a pitcher's value can be compared. Std rk = rank
        within hitters or pitchers if every category counted equally. Yahoo = final 2026 rank in our league (blank if
        Yahoo didn't list him in its top 300). Positions follow Yahoo's rule of 5 starts or 10 games at a position in 2026; pitchers are SP with 5+ starts
        and RP with 10+ relief appearances. Small sample = under 300 AB, or under 80 IP for starters and 40 IP for relievers.
      </p>
    </section>
  )
}
