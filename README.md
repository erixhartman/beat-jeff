# Beat Jeff

A draft and season planner for Jeters Never Prosper, a 12-team Yahoo head-to-head categories league. Jeff has finished 1st, 3rd, 1st and 2nd since 2023. This site exists to change that.

## What's on it

| Tab | What it does |
| --- | --- |
| Beat Jeff | Scores every regular-season week since 2023 as if Eric had played Jeff, on a Wrigley-style scoreboard, plus the categories where Jeff wins. |
| Rankings | The top 250 hitters and pitchers of 2026 (2027 once projections are loaded), re-scored on this league's 12 categories and weighted by how much each category decided matchups here. Sortable by every category, filterable by position. |
| Draft board | A live board for draft day from the 12th pick: mark picks as they happen, see who'll likely still be there at your next turn, and watch your team's category profile fill in. Saves in your browser. |
| How we draft | What this league takes in each round, what it returns, when the starter and closer runs begin, late steals and early busts. |
| Scouting | One card per 2027 rival: finishes, draft habits, pickups, trade partners and weak categories. |
| Trades | A trade checker in league terms, plus every trade since 2023. |
| Roto | The league's what-if: standings as if we played rotisserie, every category ranked 1–12. Updated every Monday in season. |
| This week | In season: this week's matchup, categories close enough to swing, and two-start pitchers. |
| Memo | Eric's private Monday memo, read from a private repo with his GitHub token. [See a sample](https://beat-jeff.vercel.app/?demo#memo). |

## How the rankings work

Each 2026 hitter (150+ AB) and pitcher (20+ IP) gets a z-score in each category against a pool of roughly rosterable players. Rate stats (AVG, OPS, ERA, WHIP, K/BB) are scaled by playing time. Each category is then weighted by `0.5 + r`, where `r` is the correlation between a team's win rate in that category and its overall win rate across 48 team-seasons (2023–26). OPS (r = 0.62) and WHIP (0.57) count most; saves (0.03) count least.

Positions follow Yahoo's rule of 5 starts or 10 games at a position in 2026. Pitchers are SP with 5+ starts and RP with 10+ relief appearances.

This is last season's value, not a 2027 projection. The NBC/Rotoworld and Pitcher List columns show where the experts have each player for 2027.

## Data

- League history: the league's public Yahoo pages, 2023–26 (standings, matchups, drafts, transactions).
- 2026 stats and fielding: the MLB Stats API.
- 2027 ranks: NBC/Rotoworld's top 300 (Oct. 19, 2026; top 150 used) and Pitcher List's top 200 starting pitchers.

Everything the site reads is a static JSON file in `public/data`, built by the Python scripts in `pipeline/`:

```
cd pipeline
python build_values.py   # 2026 rankings -> values.json
python build_league.py   # history, tendencies, scouting -> league.json
python build_board.py    # 2027 draft pool -> board.json
python build_jeff.py     # Eric vs. Jeff weekly -> jeff.json
```

## Loading 2027 projections

Fill in `pipeline/projections_template.xlsx` (or any workbook with a Hitters and a Pitchers sheet; column names are flexible), then:

```
cd pipeline
python import_projections.py path/to/projections.xlsx
python build_values.py --projections data/projections.json
python build_board.py
```

The importer matches each row to an MLB player by MLBAM ID, or by name and team, and lists anything it couldn't match cleanly. The Rankings tab, the draft board's rank column and the trade checker all switch to the projections. Positions still follow 2026 Yahoo eligibility; players new to MLB use the sheet's Pos column. The draft board's expected pick still comes from the experts' rankings, because that column is about where the room will draft a player, not what he's worth.

## In season

`.github/workflows/update.yml` runs `pipeline/update_week.py` every morning. It finds the season's league on its own from the league's permanent Yahoo address and waits until Yahoo has renewed it and the draft is done. Eric's team is the one marked Commissioner. From then on it fills in This week daily, and each Monday it adds the finished week to the roto standings and the Beat Jeff scoreboard. It only reads public pages; there are no logins or keys. The private Monday memo runs separately in `erixhartman/beat-jeff-memo`.

## Run it locally

```
npm install
npm run dev
```

Built with Vite and React. Hosted on Vercel.
