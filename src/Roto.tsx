import { useState } from 'react'
import { useData, catLabel, fmt2, fmt3 } from './data.ts'

const CATS = ['R', 'HR', 'RBI', 'SB', 'AVG', 'OPS', 'W', 'SV', 'K', 'ERA', 'WHIP', 'KBB']
interface Row { team: string; points: number; move: number; cats: Record<string, { value: number; pts: number }> }
interface Roto { season: number; throughWeek: number; updated: string; standings: Row[] }

const fmt = (c: string, v: number) => (c === 'AVG' || c === 'OPS' ? fmt3(v) : c === 'ERA' || c === 'WHIP' || c === 'KBB' ? fmt2(v) : String(Math.round(v)))

export default function RotoTab() {
  const d = useData<Roto>('roto.json')
  const [show, setShow] = useState<'pts' | 'value'>('pts')
  if (!d) return <p>Loading…</p>
  const live = d.season >= 2027
  return (
    <section>
      <h2>If we played roto</h2>
      <p className="lede">
        The league's favourite what-if: every category ranked 1–12 on season totals, 12 points for first, ties split.
        {live ? ` Through week ${d.throughWeek}, updated every Monday morning.` : ` Showing the final 2026 regular season until the 2027 season starts; then it updates every Monday morning.`}
      </p>
      <div className="controls">
        <div className="seg" role="group" aria-label="Show">
          <button aria-pressed={show === 'pts'} onClick={() => setShow('pts')}>Points</button>
          <button aria-pressed={show === 'value'} onClick={() => setShow('value')}>Totals</button>
        </div>
      </div>
      <div className="table-wrap" tabIndex={0}>
        <table className="stats">
          <thead>
            <tr>
              <th>#</th><th className="l">Team</th><th>Points</th>{live && <th>Move</th>}
              {CATS.map(c => <th key={c}>{catLabel(c)}</th>)}
            </tr>
          </thead>
          <tbody>
            {d.standings.map((r, i) => (
              <tr key={r.team}>
                <td>{i + 1}</td>
                <td className="l name">{r.team}</td>
                <td className="val">{r.points % 1 ? r.points.toFixed(1) : r.points}</td>
                {live && <td className={r.move > 0 ? 'z-pos' : r.move < 0 ? 'z-neg' : 'dim'}>{r.move > 0 ? `▲${r.move}` : r.move < 0 ? `▼${-r.move}` : '–'}</td>}
                {CATS.map(c => (
                  <td key={c} className={show === 'pts' ? (r.cats[c].pts >= 10 ? 'z-pos' : r.cats[c].pts <= 3 ? 'z-neg' : '') : ''}>
                    {show === 'pts' ? (r.cats[c].pts % 1 ? r.cats[c].pts.toFixed(1) : r.cats[c].pts) : fmt(c, r.cats[c].value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">
        Built from each week's matchup totals. Counting stats are exact; AVG is exact; ERA, WHIP and K/BB are rebuilt from weekly lines and OPS is
        weighted by at-bats, so those can differ from Yahoo's by a hair. Updated {d.updated}.
      </p>
    </section>
  )
}
