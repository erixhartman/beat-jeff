import { useData, catLabel, type WeekData } from './data.ts'

const CATS = ['R', 'HR', 'RBI', 'SB', 'AVG', 'OPS', 'W', 'SV', 'K', 'ERA', 'WHIP', 'KBB']
const LOW = new Set(['ERA', 'WHIP'])

// How close a category is, as a share of the leader's number. Under ~8% is worth chasing.
function gap(c: string, a: number, b: number) {
  if (!isFinite(a) || !isFinite(b)) return null
  const lead = LOW.has(c) ? Math.min(a, b) : Math.max(a, b)
  if (!lead) return a === b ? 0 : 1
  return Math.abs(a - b) / Math.abs(lead)
}

export default function Week() {
  const d = useData<WeekData>('week.json')
  if (!d) return <p>Loading…</p>
  if (d.status !== 'live') {
    return (
      <section>
        <h2>This week</h2>
        <p className="lede">{d.message ?? 'The 2027 season hasn’t started yet.'}</p>
        <p className="lede">Once it does, this tab updates every morning with:</p>
        <ul className="lede">
          <li>your categories against this week's opponent, sorted by which ones are close enough to swing</li>
          <li>a plan for the week's 4 adds: which categories to chase and which to let go</li>
          <li>starters lined up for two starts this week, from MLB's probable pitchers</li>
        </ul>
      </section>
    )
  }
  const rows = CATS.map(c => {
    const a = parseFloat(d.me?.[c] ?? ''), b = parseFloat(d.them?.[c] ?? '')
    const ahead = isFinite(a) && isFinite(b) ? (a === b ? 0 : (a > b) !== LOW.has(c) ? 1 : -1) : 0
    return { c, a: d.me?.[c] ?? '–', b: d.them?.[c] ?? '–', ahead, g: gap(c, a, b) }
  })
  const swing = rows.filter(r => r.g != null && r.g < 0.08).map(r => catLabel(r.c))
  const w = rows.filter(r => r.ahead > 0).length, l = rows.filter(r => r.ahead < 0).length
  return (
    <section>
      <h2>Week {d.week}: you vs. {d.opponent}</h2>
      <p className="bigline">Currently {w}–{l}–{12 - w - l}.{swing.length > 0 && <> Close enough to swing: {swing.join(', ')}.</>}</p>
      <div className="table-wrap">
        <table className="stats">
          <thead><tr><th className="l">Category</th><th>You</th><th>{d.opponent}</th><th className="l">Status</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.c}>
                <td className="l name">{catLabel(r.c)}</td><td>{r.a}</td><td>{r.b}</td>
                <td className={'l ' + (r.ahead > 0 ? 'z-pos' : r.ahead < 0 ? 'z-neg' : 'dim')}>
                  {r.ahead > 0 ? 'Ahead' : r.ahead < 0 ? 'Behind' : 'Tied'}{r.g != null && r.g < 0.08 && r.ahead !== 0 ? ' · close' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {d.twoStart && d.twoStart.length > 0 && (
        <>
          <h3>Two-start pitchers this week</h3>
          <p className="lede">Starters MLB lists as probable twice before Sunday. Probables only run a few days ahead, so this list grows through the week.</p>
          <div className="table-wrap">
            <table className="stats">
              <thead><tr><th className="l">Pitcher</th><th className="l">Team</th><th className="l">Starts</th></tr></thead>
              <tbody>{d.twoStart.map(p => <tr key={p.name}><td className="l name">{p.name}</td><td className="l dim">{p.team}</td><td className="l">{p.dates.join(', ')}</td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}
      <p className="note">Updated {d.updated}. Live stats from the matchup's public Yahoo page.</p>
    </section>
  )
}
