import { useState } from 'react'
import { useData, catLabel, type JeffData } from './data.ts'

const CATS = ['R', 'HR', 'RBI', 'SB', 'AVG', 'OPS', 'W', 'SV', 'K', 'ERA', 'WHIP', 'KBB']

export default function BeatJeff() {
  const d = useData<JeffData>('jeff.json')
  const [season, setSeason] = useState<number | null>(null)
  if (!d) return <p>Loading the scoreboard…</p>
  const seasons = d.seasons
  const cur = seasons.find(s => s.season === (season ?? seasons[seasons.length - 1].season))!
  const total = (ws: typeof cur.weeks) => ws.reduce((a, w) => [a[0] + w.w, a[1] + w.l, a[2] + w.t], [0, 0, 0])
  const life = total(seasons.flatMap(s => s.weeks))
  const [w, l, t] = total(cur.weeks)
  const weeksWon = cur.weeks.filter(x => x.w > x.l).length
  const weeksLost = cur.weeks.filter(x => x.w < x.l).length
  const actual = seasons.flatMap(s => s.weeks.filter(x => x.actual).map(x => ({ ...x, season: s.season })))

  // category-by-category: weeks each of you won that category, all seasons
  const lowGood = new Set(['ERA', 'WHIP'])
  const catTable = CATS.map(c => {
    let e = 0, j = 0
    seasons.forEach(s => s.weeks.forEach(x => {
      const a = x.eric[c], b = x.jeff[c]
      if (a == null || b == null || a === b) return
      if ((a > b) !== lowGood.has(c)) e++; else j++
    }))
    return { c, e, j }
  })
  const allPlay = (k: 'ericAllPlay' | 'jeffAllPlay') => cur.weeks.reduce((a, x) => [a[0] + x[k][0], a[1] + x[k][1], a[2] + x[k][2]], [0, 0, 0])
  const ea = allPlay('ericAllPlay'), ja = allPlay('jeffAllPlay')
  const apPct = (r: number[]) => ((r[0] + r[2] / 2) / (r[0] + r[1] + r[2]) * 100).toFixed(1)

  return (
    <section>
      <h2>You vs. Jeff, every week</h2>
      <p className="lede">
        Jeff has finished 1st, 3rd, 1st and 2nd. This scores every regular-season week as if you'd played him: each number is how many of the
        12 categories you won that week. A lit number won the week.
      </p>
      <p className="bigline">Since 2023: {life[0]}–{life[1]}–{life[2]} in categories against Jeff.</p>

      <div className="controls">
        <div className="seg" role="group" aria-label="Season">
          {seasons.map(s => <button key={s.season} aria-pressed={s.season === cur.season} onClick={() => setSeason(s.season)}>{s.season}</button>)}
        </div>
      </div>

      <div className="scoreboard" tabIndex={0} aria-label="Weekly scoreboard, Eric against Jeff" role="region" style={{ ['--n' as string]: cur.weeks.length }}>
        <div className="sb-row">
          <div className="sb-label" style={{ fontSize: 15, color: '#c9d4cc' }}>Week</div>
          {cur.weeks.map(x => <div key={x.week} className="sb-head">{x.week}</div>)}
          <div className="sb-head">Cats</div>
        </div>
        <div className="sb-row">
          <div className="sb-label">Eric</div>
          {cur.weeks.map(x => <div key={x.week} className={'sb-cell' + (x.w > x.l ? ' win' : '')} title={`Week ${x.week}: ${x.w}-${x.l}-${x.t}`}>{x.w}{x.w > x.l && <span className="sr-only"> (Eric won week {x.week})</span>}</div>)}
          <div className="sb-cell sb-total">{w}</div>
        </div>
        <div className="sb-row">
          <div className="sb-label">Jeff</div>
          {cur.weeks.map(x => <div key={x.week} className={'sb-cell' + (x.l > x.w ? ' win' : '')}>{x.l}{x.l > x.w && <span className="sr-only"> (Jeff won week {x.week})</span>}</div>)}
          <div className="sb-cell sb-total">{l}</div>
        </div>
        <p className="sb-caption">
          {cur.season}: {cur.eric} vs. {cur.jeff}. You'd have won {weeksWon} weeks and lost {weeksLost}{t ? `, with ${t} tied categories` : ''}.
          {' '}Against the whole league every week, you won {apPct(ea)}% of categories and Jeff won {apPct(ja)}%.
        </p>
      </div>

      <h3>Where Jeff beats you</h3>
      <p className="lede">Weeks each of you won each category, all four seasons combined.</p>
      <div className="table-wrap narrow" tabIndex={0}>
        <table className="stats">
          <thead><tr><th className="l">Category</th><th>Eric</th><th>Jeff</th><th className="l">Edge</th></tr></thead>
          <tbody>
            {catTable.map(r => (
              <tr key={r.c}>
                <td className="l name">{catLabel(r.c)}</td><td>{r.e}</td><td>{r.j}</td>
                <td className={'l ' + (r.e > r.j ? 'z-pos' : r.e < r.j ? 'z-neg' : 'dim')}>{r.e === r.j ? 'Even' : r.e > r.j ? `You, by ${r.e - r.j}` : `Jeff, by ${r.j - r.e}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>The real matchups</h3>
      <div className="table-wrap narrow" tabIndex={0}>
        <table className="stats">
          <thead><tr><th className="l">Season</th><th>Week</th><th>Eric</th><th>Jeff</th><th className="l">Result</th></tr></thead>
          <tbody>
            {actual.map(x => (
              <tr key={x.season + '-' + x.week}>
                <td className="l">{x.season}</td><td>{x.week}</td><td>{x.w}</td><td>{x.l}</td>
                <td className={'l ' + (x.w > x.l ? 'z-pos' : x.w < x.l ? 'z-neg' : 'dim')}>{x.w > x.l ? 'Won' : x.w < x.l ? 'Lost' : 'Tied'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">Weekly totals from each week's Yahoo matchup page. Updated {d.updated}. During the 2027 season this page refreshes after every week.</p>
    </section>
  )
}
