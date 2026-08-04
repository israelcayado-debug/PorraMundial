import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { matches, standingsPredictions, teams, tournamentConfig } from "./data/seed.js";
import { officialMatches } from "./data/officialSchedule.js";

const dataDir = path.resolve("data");
const databasePath = process.env.DATABASE_PATH || path.join(dataDir, "porra.db");
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new Database(databasePath);
db.pragma("journal_mode = WAL");

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'player',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teams (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  flag TEXT NOT NULL,
  confederation TEXT
);

CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_number INTEGER,
  stage TEXT NOT NULL,
  group_name TEXT,
  kickoff_at TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  actual_home_team TEXT,
  actual_away_team TEXT,
  actual_home_score INTEGER,
  actual_away_score INTEGER
);

CREATE TABLE IF NOT EXISTS predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  match_id INTEGER NOT NULL,
  predicted_home_score INTEGER NOT NULL,
  predicted_away_score INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, match_id),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(match_id) REFERENCES matches(id)
);

CREATE TABLE IF NOT EXISTS stage_qualifiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_name TEXT NOT NULL,
  team_code TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_qualifier_predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  group_name TEXT NOT NULL,
  first_team TEXT NOT NULL,
  second_team TEXT NOT NULL,
  UNIQUE(user_id, group_name)
);

CREATE TABLE IF NOT EXISTS user_group_order_predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  group_name TEXT NOT NULL,
  team_order TEXT NOT NULL,
  UNIQUE(user_id, group_name)
);

CREATE TABLE IF NOT EXISTS official_group_order (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_name TEXT NOT NULL UNIQUE,
  team_order TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bonus_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  question_key TEXT NOT NULL,
  answer_value TEXT NOT NULL,
  UNIQUE(user_id, question_key)
);

CREATE TABLE IF NOT EXISTS bonus_results (
  question_key TEXT PRIMARY KEY,
  correct_value TEXT NOT NULL
);
`;

db.exec(schema);

const userColumns = db.prepare("PRAGMA table_info(users)").all();
if (!userColumns.some((column) => column.name === "role")) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'player'");
}

if (!userColumns.some((column) => column.name === "status")) {
  db.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'");
}

const matchColumns = db.prepare("PRAGMA table_info(matches)").all();
if (!matchColumns.some((column) => column.name === "match_number")) {
  db.exec("ALTER TABLE matches ADD COLUMN match_number INTEGER");
}

if (!matchColumns.some((column) => column.name === "actual_home_team")) {
  db.exec("ALTER TABLE matches ADD COLUMN actual_home_team TEXT");
}

if (!matchColumns.some((column) => column.name === "actual_away_team")) {
  db.exec("ALTER TABLE matches ADD COLUMN actual_away_team TEXT");
}

// Knockout participants must remain bracket references (2A, W73, and so on).
// Replacing them with the official teams makes every player see and score the
// same bracket instead of the bracket produced by their own predictions.
const bracketTemplates = officialMatches.filter((match) => match.stage !== "groups");
const hasOfficialBracket = bracketTemplates.some((match) => (
  db.prepare("SELECT 1 FROM matches WHERE match_number = ?").get(match.match_number)
));

if (hasOfficialBracket) {
  const restoreBracketTemplate = db.prepare(`
    UPDATE matches
    SET home_team = ?, away_team = ?, group_name = ?
    WHERE match_number = ? AND stage != 'groups'
  `);
  const restoreBracketTemplates = db.transaction(() => {
    for (const match of bracketTemplates) {
      restoreBracketTemplate.run(
        match.home_team,
        match.away_team,
        match.group_name ?? null,
        match.match_number
      );
    }
  });
  restoreBracketTemplates();
}

const countRow = (table) => db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;

if (countRow("teams") === 0) {
  const stmt = db.prepare("INSERT INTO teams (code, name, flag, confederation) VALUES (@code, @name, @flag, @confederation)");
  const insertMany = db.transaction((rows) => rows.forEach((row) => stmt.run(row)));
  insertMany(teams);
}

if (countRow("matches") === 0) {
  const stmt = db.prepare(`
    INSERT INTO matches (match_number, stage, group_name, kickoff_at, home_team, away_team, actual_home_score, actual_away_score)
    VALUES (@match_number, @stage, @group_name, @kickoff_at, @home_team, @away_team, @actual_home_score, @actual_away_score)
  `);
  const insertMany = db.transaction((rows) => rows.forEach((row, index) => stmt.run({
    match_number: row.match_number ?? index + 1,
    ...row
  })));
  insertMany(matches);
}

if (countRow("stage_qualifiers") === 0) {
  const stmt = db.prepare("INSERT INTO stage_qualifiers (group_name, team_code) VALUES (@group_name, @team_code)");
  const insertMany = db.transaction((rows) => rows.forEach((row) => stmt.run(row)));
  insertMany(standingsPredictions);
}

if (countRow("users") === 0) {
  const passwordHash = bcrypt.hashSync("demo1234", 10);
  db.prepare("INSERT INTO users (email, password_hash, display_name, role) VALUES (?, ?, ?, ?)").run(
    "demo@porra.local",
    passwordHash,
    "Capitán Demo",
    "admin"
  );
}

db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run("demo@porra.local");
db.prepare("UPDATE users SET status = 'approved' WHERE role = 'admin'").run();

export { db, tournamentConfig };
