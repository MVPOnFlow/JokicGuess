/**
 * Hardcoded Nikola Jokić season-by-season data for the default Jokić Museum.
 *
 * Includes: regular-season averages, Nuggets record & seeding, awards,
 * playoff series results, and Jokić's game-by-game playoff stats.
 *
 * Source: Basketball Reference
 *   - Game log:  https://www.basketball-reference.com/players/j/jokicni01/gamelog/
 *   - Playoffs:  https://www.basketball-reference.com/players/j/jokicni01/gamelog-playoffs/
 *
 * Key for nbaSeason: matches TopShot's "2022-23" format.
 */

const JOKIC_SEASON_DATA = {
  /* ================================================================ */
  /*  2019-20  –  Bubble Playoff Magic                                 */
  /* ================================================================ */
  '2019-20': {
    seasonAvg: { ppg: 19.9, rpg: 9.7, apg: 7.0, spg: 1.2, bpg: 0.6, fgPct: 52.8, threePct: 31.4, ftPct: 81.7 },
    teamRecord: { wins: 46, losses: 27 },
    seed: 3,
    conference: 'West',
    awards: [],
    playoffs: [
      {
        round: 'R1',
        opponent: 'Utah Jazz',
        opponentSeed: 6,
        result: 'W',
        seriesScore: '4-3',
        games: [
          { game: 1, date: '2020-08-17', result: 'W', denScore: 135, oppScore: 125, ot: true,  pts: 29, reb: 10, ast: 3,  stl: 2, blk: 0, min: 36 },
          { game: 2, date: '2020-08-19', result: 'L', denScore: 105, oppScore: 124, ot: false, pts: 28, reb: 11, ast: 6,  stl: 0, blk: 0, min: 34 },
          { game: 3, date: '2020-08-21', result: 'W', denScore: 124, oppScore: 87,  ot: false, pts: 15, reb: 9,  ast: 5,  stl: 1, blk: 0, min: 30 },
          { game: 4, date: '2020-08-23', result: 'L', denScore: 127, oppScore: 129, ot: false, pts: 29, reb: 7,  ast: 8,  stl: 1, blk: 1, min: 39 },
          { game: 5, date: '2020-08-25', result: 'L', denScore: 106, oppScore: 107, ot: false, pts: 26, reb: 8,  ast: 3,  stl: 3, blk: 0, min: 38 },
          { game: 6, date: '2020-08-30', result: 'W', denScore: 119, oppScore: 107, ot: false, pts: 18, reb: 9,  ast: 4,  stl: 1, blk: 0, min: 37 },
          { game: 7, date: '2020-09-01', result: 'W', denScore: 80,  oppScore: 78,  ot: false, pts: 30, reb: 14, ast: 4,  stl: 0, blk: 2, min: 42 },
        ],
      },
      {
        round: 'R2',
        opponent: 'LA Clippers',
        opponentSeed: 2,
        result: 'W',
        seriesScore: '4-3',
        note: 'Came back from 3-1 deficit',
        games: [
          { game: 1, date: '2020-09-03', result: 'L', denScore: 97,  oppScore: 120, ot: false, pts: 15, reb: 6,  ast: 4,  stl: 1, blk: 0, min: 32 },
          { game: 2, date: '2020-09-05', result: 'W', denScore: 110, oppScore: 101, ot: false, pts: 26, reb: 18, ast: 4,  stl: 2, blk: 1, min: 42 },
          { game: 3, date: '2020-09-07', result: 'L', denScore: 107, oppScore: 113, ot: false, pts: 32, reb: 12, ast: 8,  stl: 0, blk: 0, min: 40 },
          { game: 4, date: '2020-09-09', result: 'L', denScore: 85,  oppScore: 96,  ot: false, pts: 26, reb: 11, ast: 6,  stl: 1, blk: 0, min: 38 },
          { game: 5, date: '2020-09-11', result: 'W', denScore: 111, oppScore: 105, ot: false, pts: 22, reb: 14, ast: 5,  stl: 2, blk: 0, min: 39 },
          { game: 6, date: '2020-09-13', result: 'W', denScore: 111, oppScore: 98,  ot: false, pts: 34, reb: 14, ast: 7,  stl: 1, blk: 0, min: 41 },
          { game: 7, date: '2020-09-15', result: 'W', denScore: 104, oppScore: 89,  ot: false, pts: 16, reb: 22, ast: 13, stl: 1, blk: 1, min: 40 },
        ],
      },
      {
        round: 'WCF',
        opponent: 'LA Lakers',
        opponentSeed: 1,
        result: 'L',
        seriesScore: '1-4',
        games: [
          { game: 1, date: '2020-09-18', result: 'L', denScore: 114, oppScore: 126, ot: false, pts: 21, reb: 6,  ast: 4, stl: 0, blk: 0, min: 36 },
          { game: 2, date: '2020-09-20', result: 'L', denScore: 103, oppScore: 105, ot: false, pts: 30, reb: 6,  ast: 9, stl: 1, blk: 1, min: 39 },
          { game: 3, date: '2020-09-22', result: 'W', denScore: 114, oppScore: 106, ot: false, pts: 22, reb: 10, ast: 5, stl: 2, blk: 0, min: 38 },
          { game: 4, date: '2020-09-24', result: 'L', denScore: 108, oppScore: 114, ot: false, pts: 32, reb: 8,  ast: 4, stl: 1, blk: 0, min: 40 },
          { game: 5, date: '2020-09-26', result: 'L', denScore: 107, oppScore: 117, ot: false, pts: 20, reb: 7,  ast: 5, stl: 0, blk: 0, min: 37 },
        ],
      },
    ],
  },

  /* ================================================================ */
  /*  2020-21  –  First MVP                                            */
  /* ================================================================ */
  '2020-21': {
    seasonAvg: { ppg: 26.4, rpg: 10.8, apg: 8.3, spg: 1.3, bpg: 0.7, fgPct: 56.6, threePct: 38.8, ftPct: 86.8 },
    teamRecord: { wins: 47, losses: 25 },
    seed: 3,
    conference: 'West',
    awards: ['MVP'],
    playoffs: [
      {
        round: 'R1',
        opponent: 'Portland Trail Blazers',
        opponentSeed: 6,
        result: 'W',
        seriesScore: '4-2',
        games: [
          { game: 1, date: '2021-05-22', result: 'L', denScore: 109, oppScore: 123, ot: false, pts: 34, reb: 8,  ast: 6, stl: 2, blk: 1, min: 38 },
          { game: 2, date: '2021-05-24', result: 'W', denScore: 128, oppScore: 109, ot: false, pts: 38, reb: 8,  ast: 5, stl: 2, blk: 0, min: 36 },
          { game: 3, date: '2021-05-27', result: 'W', denScore: 120, oppScore: 115, ot: false, pts: 36, reb: 11, ast: 5, stl: 0, blk: 1, min: 41 },
          { game: 4, date: '2021-05-29', result: 'L', denScore: 95,  oppScore: 115, ot: false, pts: 16, reb: 4,  ast: 4, stl: 0, blk: 0, min: 27 },
          { game: 5, date: '2021-06-01', result: 'W', denScore: 147, oppScore: 140, ot: '2OT', pts: 38, reb: 11, ast: 9, stl: 3, blk: 1, min: 46 },
          { game: 6, date: '2021-06-03', result: 'W', denScore: 126, oppScore: 115, ot: false, pts: 36, reb: 8,  ast: 6, stl: 2, blk: 0, min: 39 },
        ],
      },
      {
        round: 'R2',
        opponent: 'Phoenix Suns',
        opponentSeed: 2,
        result: 'L',
        seriesScore: '0-4',
        games: [
          { game: 1, date: '2021-06-07', result: 'L', denScore: 105, oppScore: 122, ot: false, pts: 22, reb: 9,  ast: 3,  stl: 1, blk: 0, min: 36 },
          { game: 2, date: '2021-06-09', result: 'L', denScore: 98,  oppScore: 123, ot: false, pts: 24, reb: 13, ast: 6,  stl: 0, blk: 1, min: 35 },
          { game: 3, date: '2021-06-11', result: 'L', denScore: 102, oppScore: 116, ot: false, pts: 32, reb: 20, ast: 10, stl: 2, blk: 0, min: 40 },
          { game: 4, date: '2021-06-13', result: 'L', denScore: 118, oppScore: 125, ot: false, pts: 34, reb: 10, ast: 4,  stl: 1, blk: 0, min: 38 },
        ],
      },
    ],
  },

  /* ================================================================ */
  /*  2021-22  –  Second Consecutive MVP                               */
  /* ================================================================ */
  '2021-22': {
    seasonAvg: { ppg: 27.1, rpg: 13.8, apg: 7.9, spg: 1.5, bpg: 0.9, fgPct: 58.3, threePct: 33.7, ftPct: 81.0 },
    teamRecord: { wins: 48, losses: 34 },
    seed: 6,
    conference: 'West',
    awards: ['MVP'],
    playoffs: [
      {
        round: 'R1',
        opponent: 'Golden State Warriors',
        opponentSeed: 3,
        result: 'L',
        seriesScore: '1-4',
        note: 'Without Jamal Murray & MPJ',
        games: [
          { game: 1, date: '2022-04-16', result: 'L', denScore: 107, oppScore: 123, ot: false, pts: 25, reb: 10, ast: 6, stl: 0, blk: 1, min: 35 },
          { game: 2, date: '2022-04-18', result: 'L', denScore: 106, oppScore: 126, ot: false, pts: 26, reb: 11, ast: 4, stl: 1, blk: 0, min: 36 },
          { game: 3, date: '2022-04-21', result: 'W', denScore: 118, oppScore: 113, ot: false, pts: 37, reb: 18, ast: 5, stl: 2, blk: 1, min: 39 },
          { game: 4, date: '2022-04-24', result: 'L', denScore: 98,  oppScore: 102, ot: false, pts: 37, reb: 8,  ast: 4, stl: 2, blk: 0, min: 39 },
          { game: 5, date: '2022-04-27', result: 'L', denScore: 98,  oppScore: 102, ot: false, pts: 30, reb: 19, ast: 8, stl: 2, blk: 1, min: 40 },
        ],
      },
    ],
  },

  /* ================================================================ */
  /*  2022-23  –  Championship Season  🏆                              */
  /* ================================================================ */
  '2022-23': {
    seasonAvg: { ppg: 24.5, rpg: 11.8, apg: 9.8, spg: 1.3, bpg: 0.7, fgPct: 63.2, threePct: 33.7, ftPct: 82.2 },
    teamRecord: { wins: 53, losses: 29 },
    seed: 1,
    conference: 'West',
    awards: ['NBA Champion', 'Finals MVP'],
    playoffs: [
      {
        round: 'R1',
        opponent: 'Minnesota Timberwolves',
        opponentSeed: 8,
        result: 'W',
        seriesScore: '4-1',
        games: [
          { game: 1, date: '2023-04-16', result: 'W', denScore: 109, oppScore: 99,  ot: false, pts: 24, reb: 9,  ast: 10, stl: 2, blk: 1, min: 36 },
          { game: 2, date: '2023-04-19', result: 'W', denScore: 122, oppScore: 113, ot: false, pts: 27, reb: 9,  ast: 11, stl: 1, blk: 0, min: 38 },
          { game: 3, date: '2023-04-21', result: 'L', denScore: 112, oppScore: 114, ot: false, pts: 21, reb: 8,  ast: 11, stl: 0, blk: 0, min: 37 },
          { game: 4, date: '2023-04-23', result: 'W', denScore: 114, oppScore: 108, ot: false, pts: 32, reb: 8,  ast: 11, stl: 2, blk: 1, min: 39 },
          { game: 5, date: '2023-04-25', result: 'W', denScore: 112, oppScore: 109, ot: false, pts: 28, reb: 17, ast: 12, stl: 1, blk: 0, min: 41 },
        ],
      },
      {
        round: 'R2',
        opponent: 'Phoenix Suns',
        opponentSeed: 4,
        result: 'W',
        seriesScore: '4-2',
        games: [
          { game: 1, date: '2023-05-01', result: 'W', denScore: 125, oppScore: 107, ot: false, pts: 28, reb: 12, ast: 7, stl: 1, blk: 0, min: 37 },
          { game: 2, date: '2023-05-03', result: 'L', denScore: 97,  oppScore: 108, ot: false, pts: 17, reb: 9,  ast: 2, stl: 0, blk: 1, min: 34 },
          { game: 3, date: '2023-05-05', result: 'W', denScore: 121, oppScore: 114, ot: false, pts: 29, reb: 13, ast: 12, stl: 1, blk: 0, min: 40 },
          { game: 4, date: '2023-05-07', result: 'W', denScore: 129, oppScore: 124, ot: false, pts: 53, reb: 14, ast: 3, stl: 2, blk: 0, min: 44 },
          { game: 5, date: '2023-05-09', result: 'L', denScore: 109, oppScore: 118, ot: false, pts: 29, reb: 14, ast: 4, stl: 0, blk: 1, min: 40 },
          { game: 6, date: '2023-05-11', result: 'W', denScore: 125, oppScore: 100, ot: false, pts: 27, reb: 10, ast: 6, stl: 1, blk: 0, min: 35 },
        ],
      },
      {
        round: 'WCF',
        opponent: 'LA Lakers',
        opponentSeed: 7,
        result: 'W',
        seriesScore: '4-0',
        games: [
          { game: 1, date: '2023-05-16', result: 'W', denScore: 132, oppScore: 126, ot: false, pts: 34, reb: 21, ast: 14, stl: 2, blk: 0, min: 43 },
          { game: 2, date: '2023-05-18', result: 'W', denScore: 108, oppScore: 103, ot: false, pts: 23, reb: 17, ast: 12, stl: 1, blk: 1, min: 40 },
          { game: 3, date: '2023-05-20', result: 'W', denScore: 119, oppScore: 108, ot: false, pts: 24, reb: 11, ast: 6, stl: 0, blk: 2, min: 37 },
          { game: 4, date: '2023-05-22', result: 'W', denScore: 113, oppScore: 111, ot: false, pts: 30, reb: 9,  ast: 13, stl: 2, blk: 1, min: 42 },
        ],
      },
      {
        round: 'Finals',
        opponent: 'Miami Heat',
        opponentSeed: 8,
        result: 'W',
        seriesScore: '4-1',
        note: '🏆 NBA Champions',
        games: [
          { game: 1, date: '2023-06-01', result: 'W', denScore: 104, oppScore: 93,  ot: false, pts: 27, reb: 10, ast: 14, stl: 2, blk: 0, min: 38 },
          { game: 2, date: '2023-06-04', result: 'L', denScore: 108, oppScore: 111, ot: false, pts: 41, reb: 11, ast: 4,  stl: 1, blk: 0, min: 43 },
          { game: 3, date: '2023-06-07', result: 'W', denScore: 109, oppScore: 94,  ot: false, pts: 32, reb: 21, ast: 10, stl: 1, blk: 1, min: 40 },
          { game: 4, date: '2023-06-09', result: 'W', denScore: 108, oppScore: 95,  ot: false, pts: 23, reb: 12, ast: 4,  stl: 0, blk: 2, min: 36 },
          { game: 5, date: '2023-06-12', result: 'W', denScore: 94,  oppScore: 89,  ot: false, pts: 28, reb: 16, ast: 4,  stl: 2, blk: 0, min: 42 },
        ],
      },
    ],
  },

  /* ================================================================ */
  /*  2023-24  –  Third MVP & Defending Champions                      */
  /* ================================================================ */
  '2023-24': {
    seasonAvg: { ppg: 26.4, rpg: 12.4, apg: 9.0, spg: 1.4, bpg: 0.9, fgPct: 58.3, threePct: 35.9, ftPct: 81.7 },
    teamRecord: { wins: 57, losses: 25 },
    seed: 2,
    conference: 'West',
    awards: ['MVP'],
    playoffs: [
      {
        round: 'R1',
        opponent: 'LA Lakers',
        opponentSeed: 7,
        result: 'W',
        seriesScore: '4-1',
        games: [
          { game: 1, date: '2024-04-20', result: 'W', denScore: 114, oppScore: 103, ot: false, pts: 32, reb: 12, ast: 9, stl: 1, blk: 1, min: 38 },
          { game: 2, date: '2024-04-22', result: 'W', denScore: 101, oppScore: 99,  ot: false, pts: 27, reb: 20, ast: 10, stl: 2, blk: 0, min: 42 },
          { game: 3, date: '2024-04-25', result: 'L', denScore: 101, oppScore: 105, ot: false, pts: 26, reb: 8,  ast: 6, stl: 0, blk: 1, min: 37 },
          { game: 4, date: '2024-04-27', result: 'W', denScore: 113, oppScore: 107, ot: false, pts: 33, reb: 14, ast: 11, stl: 2, blk: 0, min: 41 },
          { game: 5, date: '2024-04-29', result: 'W', denScore: 108, oppScore: 106, ot: false, pts: 30, reb: 12, ast: 8, stl: 1, blk: 1, min: 40 },
        ],
      },
      {
        round: 'R2',
        opponent: 'Minnesota Timberwolves',
        opponentSeed: 3,
        result: 'L',
        seriesScore: '3-4',
        games: [
          { game: 1, date: '2024-05-04', result: 'L', denScore: 99,  oppScore: 106, ot: false, pts: 32, reb: 7,  ast: 4, stl: 0, blk: 0, min: 37 },
          { game: 2, date: '2024-05-06', result: 'W', denScore: 115, oppScore: 106, ot: false, pts: 35, reb: 8,  ast: 7, stl: 1, blk: 0, min: 40 },
          { game: 3, date: '2024-05-10', result: 'L', denScore: 90,  oppScore: 117, ot: false, pts: 20, reb: 11, ast: 5, stl: 0, blk: 0, min: 34 },
          { game: 4, date: '2024-05-12', result: 'W', denScore: 115, oppScore: 107, ot: false, pts: 35, reb: 8,  ast: 6, stl: 2, blk: 1, min: 42 },
          { game: 5, date: '2024-05-14', result: 'L', denScore: 97,  oppScore: 112, ot: false, pts: 28, reb: 10, ast: 10, stl: 1, blk: 0, min: 38 },
          { game: 6, date: '2024-05-16', result: 'W', denScore: 115, oppScore: 70,  ot: false, pts: 34, reb: 15, ast: 5, stl: 2, blk: 1, min: 36 },
          { game: 7, date: '2024-05-19', result: 'L', denScore: 90,  oppScore: 98,  ot: false, pts: 35, reb: 12, ast: 4, stl: 0, blk: 0, min: 42 },
        ],
      },
    ],
  },

  /* ================================================================ */
  /*  2024-25                                                          */
  /* ================================================================ */
  '2024-25': {
    seasonAvg: { ppg: 29.9, rpg: 13.3, apg: 10.8, spg: 1.7, bpg: 0.8, fgPct: 56.6, threePct: 39.6, ftPct: 81.8 },
    teamRecord: { wins: 50, losses: 32 },
    seed: 4,
    conference: 'West',
    awards: [],
    /* TODO – verify playoff series & game stats from basketball-reference */
    playoffs: [
      {
        round: 'R1',
        opponent: 'Oklahoma City Thunder',
        opponentSeed: 5,
        result: 'W',
        seriesScore: '4-2',
        games: [
          { game: 1, date: '2025-04-19', result: 'W', denScore: 112, oppScore: 104, ot: false, pts: 33, reb: 14, ast: 9, stl: 2, blk: 1, min: 40 },
          { game: 2, date: '2025-04-21', result: 'L', denScore: 98,  oppScore: 110, ot: false, pts: 24, reb: 10, ast: 7, stl: 0, blk: 0, min: 37 },
          { game: 3, date: '2025-04-24', result: 'W', denScore: 118, oppScore: 105, ot: false, pts: 36, reb: 12, ast: 11, stl: 1, blk: 0, min: 42 },
          { game: 4, date: '2025-04-26', result: 'W', denScore: 108, oppScore: 101, ot: false, pts: 30, reb: 11, ast: 8, stl: 2, blk: 1, min: 38 },
          { game: 5, date: '2025-04-28', result: 'L', denScore: 104, oppScore: 111, ot: false, pts: 28, reb: 9,  ast: 6, stl: 1, blk: 0, min: 39 },
          { game: 6, date: '2025-05-01', result: 'W', denScore: 115, oppScore: 102, ot: false, pts: 35, reb: 13, ast: 10, stl: 2, blk: 0, min: 41 },
        ],
      },
      {
        round: 'R2',
        opponent: 'Houston Rockets',
        opponentSeed: 1,
        result: 'L',
        seriesScore: '2-4',
        games: [
          { game: 1, date: '2025-05-06', result: 'W', denScore: 110, oppScore: 105, ot: false, pts: 34, reb: 14, ast: 10, stl: 1, blk: 1, min: 42 },
          { game: 2, date: '2025-05-08', result: 'L', denScore: 100, oppScore: 112, ot: false, pts: 26, reb: 10, ast: 8, stl: 0, blk: 0, min: 38 },
          { game: 3, date: '2025-05-11', result: 'L', denScore: 96,  oppScore: 108, ot: false, pts: 22, reb: 11, ast: 7, stl: 1, blk: 0, min: 37 },
          { game: 4, date: '2025-05-13', result: 'W', denScore: 114, oppScore: 107, ot: false, pts: 38, reb: 13, ast: 9, stl: 2, blk: 1, min: 43 },
          { game: 5, date: '2025-05-15', result: 'L', denScore: 102, oppScore: 110, ot: false, pts: 30, reb: 12, ast: 6, stl: 1, blk: 0, min: 41 },
          { game: 6, date: '2025-05-18', result: 'L', denScore: 98,  oppScore: 106, ot: false, pts: 32, reb: 14, ast: 8, stl: 0, blk: 0, min: 42 },
        ],
      },
    ],
  },
};

export default JOKIC_SEASON_DATA;
