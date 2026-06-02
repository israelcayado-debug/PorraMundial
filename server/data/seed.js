export const tournamentConfig = {
  bestKeeperOptions: [
    "Emiliano Martinez",
    "Thibaut Courtois",
    "Mike Maignan",
    "Unai Simon",
    "Alisson Becker",
    "Diogo Costa"
  ],
  bonusQuestions: [
    {
      key: "topScorer",
      label: "Máximo goleador",
      type: "text",
      options: [],
      points: 10
    }
  ]
};

export const teams = [
  { code: "ESP", name: "España", flag: "🇪🇸", confederation: "UEFA" },
  { code: "ARG", name: "Argentina", flag: "🇦🇷", confederation: "CONMEBOL" },
  { code: "BRA", name: "Brasil", flag: "🇧🇷", confederation: "CONMEBOL" },
  { code: "FRA", name: "Francia", flag: "🇫🇷", confederation: "UEFA" },
  { code: "ENG", name: "Inglaterra", flag: "🏴", confederation: "UEFA" },
  { code: "POR", name: "Portugal", flag: "🇵🇹", confederation: "UEFA" },
  { code: "GER", name: "Alemania", flag: "🇩🇪", confederation: "UEFA" },
  { code: "URU", name: "Uruguay", flag: "🇺🇾", confederation: "CONMEBOL" },
  { code: "USA", name: "Estados Unidos", flag: "🇺🇸", confederation: "CONCACAF" },
  { code: "MEX", name: "México", flag: "🇲🇽", confederation: "CONCACAF" },
  { code: "JPN", name: "Japón", flag: "🇯🇵", confederation: "AFC" },
  { code: "MAR", name: "Marruecos", flag: "🇲🇦", confederation: "CAF" }
];

export const matches = [
  { stage: "groups", group_name: "A", kickoff_at: "2026-06-11T19:00:00Z", home_team: "USA", away_team: "MEX", actual_home_score: null, actual_away_score: null },
  { stage: "groups", group_name: "A", kickoff_at: "2026-06-12T19:00:00Z", home_team: "ESP", away_team: "JPN", actual_home_score: null, actual_away_score: null },
  { stage: "groups", group_name: "B", kickoff_at: "2026-06-13T19:00:00Z", home_team: "ARG", away_team: "MAR", actual_home_score: null, actual_away_score: null },
  { stage: "groups", group_name: "B", kickoff_at: "2026-06-14T19:00:00Z", home_team: "BRA", away_team: "URU", actual_home_score: null, actual_away_score: null },
  { stage: "groups", group_name: "C", kickoff_at: "2026-06-15T19:00:00Z", home_team: "FRA", away_team: "POR", actual_home_score: null, actual_away_score: null },
  { stage: "groups", group_name: "C", kickoff_at: "2026-06-16T19:00:00Z", home_team: "ENG", away_team: "GER", actual_home_score: null, actual_away_score: null },
  { stage: "round_of_16", group_name: null, kickoff_at: "2026-06-28T19:00:00Z", home_team: "ESP", away_team: "MAR", actual_home_score: null, actual_away_score: null },
  { stage: "round_of_16", group_name: null, kickoff_at: "2026-06-29T19:00:00Z", home_team: "ARG", away_team: "USA", actual_home_score: null, actual_away_score: null },
  { stage: "quarterfinals", group_name: null, kickoff_at: "2026-07-03T19:00:00Z", home_team: "ESP", away_team: "ARG", actual_home_score: null, actual_away_score: null },
  { stage: "final", group_name: null, kickoff_at: "2026-07-19T19:00:00Z", home_team: "ESP", away_team: "BRA", actual_home_score: null, actual_away_score: null }
];

export const standingsPredictions = [
  { group_name: "A", team_code: "USA" },
  { group_name: "A", team_code: "MEX" },
  { group_name: "B", team_code: "ARG" },
  { group_name: "B", team_code: "BRA" },
  { group_name: "C", team_code: "FRA" },
  { group_name: "C", team_code: "ENG" }
];
