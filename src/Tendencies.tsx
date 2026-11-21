import { useData, type League } from './data.ts'

export default function Tendencies() {
  const lg = useData<League>('league.json')
  if (!lg) return <p>Loading…</p>
  const pct = (n: number | null) => (n == null ? '–' : `${n}%`)
  return (
    <section>
      <h2>How this league drafts</h2>
      <p className="lede">
        Four drafts (2023–26), 1,056 picks, each judged by the player's final Yahoo rank in our league. The short version: hitters early pay off,
        closers look cheap but mostly buy saves we don't need, and late starters are lottery tickets.
      </p>

      <h3>What goes when, and what it returns</h3>
      <div className="table-wrap">
        <table className="stats">
          <thead>
            <tr>
              <th className="l">Rounds</th><th>Picks</th>
              <th>Hitters taken</th><th>SP taken</th><th>Closers taken</th>
              <th>Hitters: top 100</th><th>Median rank</th>
              <th>SP: top 100</th><th>Median rank</th>
              <th>Closers: top 100</th><th>Median rank</th>
            </tr>
          </thead>
          <tbody>
            {lg.tendencies.map(t => (
              <tr key={t.rounds}>
                <td className="l name">{t.rounds}</td><td>{t.n}</td>
                <td>{t.share.H}%</td><td>{t.share.SP}%</td><td>{t.share.RP}%</td>
                <td className="val">{pct(t.H.top100)}</td><td className="dim">{t.H.median ?? '–'}</td>
                <td className="val">{pct(t.SP.top100)}</td><td className="dim">{t.SP.median ?? '–'}</td>
                <td className="val">{pct(t.RP.top100)}</td><td className="dim">{t.RP.median ?? '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">Closers = pitchers with 10+ saves that season. A missing figure means fewer than five such picks in that range. Shares don't add to 100% where a player didn't appear in Yahoo's final top 300.</p>

      <h3>When the runs start</h3>
      <p className="lede">The overall pick where the first starter, 12th starter, first closer and fifth closer went each year. With the 12th pick, your turns are 12/13, 36/37, 60/61 and 84/85.</p>
      <div className="table-wrap narrow">
        <table className="stats">
          <thead><tr><th className="l">Draft</th><th>1st SP</th><th>12th SP</th><th>1st closer</th><th>5th closer</th></tr></thead>
          <tbody>
            {lg.runs.map(r => (
              <tr key={r.season}><td className="l name">{r.season}</td><td>{r.firstSP}</td><td>{r.twelfthSP}</td><td>{r.firstRP}</td><td>{r.fifthRP}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mine-note">My read: twelve starters are gone by about pick 45, so if you want a top-12 arm it has to come at 36 or 37. The closer run starts around 60 and you can let it go.</p>

      <h3>Late steals</h3>
      <p className="lede">Round 10 or later, finished top 40.</p>
      <div className="table-wrap mid">
        <table className="stats">
          <thead><tr><th className="l">Year</th><th>Round</th><th className="l">Player</th><th>Final rank</th><th className="l">Drafted by</th></tr></thead>
          <tbody>{lg.steals.map(s => <tr key={s.season + s.player}><td className="l">{s.season}</td><td>{s.round}</td><td className="l name">{s.player}</td><td>{s.rank}</td><td className="l dim">{s.by}</td></tr>)}</tbody>
        </table>
      </div>

      <h3>Early busts</h3>
      <p className="lede">Rounds 1–3, finished worse than 250th. The worst were injuries (Yordan in 2025, Acuña and Strider in 2024), but plenty were just bad years. It happens to two or three teams every draft.</p>
      <div className="table-wrap mid">
        <table className="stats">
          <thead><tr><th className="l">Year</th><th>Round</th><th className="l">Player</th><th>Final rank</th><th className="l">Drafted by</th></tr></thead>
          <tbody>{lg.busts.map(s => <tr key={s.season + s.player}><td className="l">{s.season}</td><td>{s.round}</td><td className="l name">{s.player}</td><td>{s.rank}</td><td className="l dim">{s.by}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  )
}
