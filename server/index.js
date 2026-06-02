import path from "node:path";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import dayjs from "dayjs";
import { db, tournamentConfig } from "./db.js";
import { adminMiddleware, authMiddleware, signToken } from "./auth.js";
import { getDashboardForUser, getLeaderboard } from "./scoring.js";
import { sendAccountDecisionEmail, sendDailyDigestToAllUsers } from "./services/mailer.js";
import { officialMatches, officialTeams } from "./data/officialSchedule.js";

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json());

function getTournamentSettings() {
  const firstKickoff = db.prepare("SELECT kickoff_at FROM matches ORDER BY kickoff_at LIMIT 1").get()?.kickoff_at ?? null;
  const bettingClosesAt = firstKickoff ? dayjs(firstKickoff).subtract(1, "day").toISOString() : null;
  const betsLocked = bettingClosesAt ? dayjs().isAfter(dayjs(bettingClosesAt)) : false;

  return {
    firstKickoff,
    bettingClosesAt,
    betsLocked
  };
}

function getPublicTournamentData() {
  const teams = db.prepare("SELECT * FROM teams ORDER BY name").all();
  const matches = db.prepare("SELECT * FROM matches ORDER BY kickoff_at").all();
  const qualifierGroupsMap = new Map();

  for (const match of matches) {
    if (match.stage !== "groups" || !match.group_name) {
      continue;
    }

    const current = qualifierGroupsMap.get(match.group_name) ?? [];
    if (!current.includes(match.home_team)) {
      current.push(match.home_team);
    }
    if (!current.includes(match.away_team)) {
      current.push(match.away_team);
    }
    qualifierGroupsMap.set(match.group_name, current);
  }

  const qualifierGroups = [...qualifierGroupsMap.entries()]
    .sort(([groupA], [groupB]) => groupA.localeCompare(groupB))
    .map(([group_name, groupTeams]) => ({
      group_name,
      teams: groupTeams.join(",")
    }));

  return {
    teams,
    matches,
    qualifierGroups,
    bonusQuestions: tournamentConfig.bonusQuestions,
    settings: getTournamentSettings()
  };
}

function getUserPayload(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    role: user.role,
    status: user.status
  };
}

function ensureBetsOpen(res) {
  if (getTournamentSettings().betsLocked) {
    res.status(423).json({ error: "Las apuestas están cerradas desde 24 horas antes del inicio del Mundial" });
    return false;
  }
  return true;
}

function getAdminData() {
  const users = db.prepare("SELECT id, email, display_name, role, status, created_at FROM users ORDER BY created_at DESC").all();
  const matches = db.prepare("SELECT * FROM matches ORDER BY kickoff_at").all();
  const bonusResults = db.prepare("SELECT question_key, correct_value FROM bonus_results ORDER BY question_key").all();
  const qualifiers = db.prepare("SELECT group_name, team_code FROM stage_qualifiers ORDER BY group_name, team_code").all();
  const officialGroupOrders = db.prepare("SELECT group_name, team_order FROM official_group_order ORDER BY group_name").all();
  return {
    users,
    matches,
    bonusResults,
    qualifiers,
    officialGroupOrders,
    mail: {
      configured: Boolean(process.env.EMAIL_HOST)
    }
  };
}

function validateMatchPayload({ stage, kickoffAt, homeTeam, awayTeam }) {
  if (!stage || !kickoffAt || !homeTeam || !awayTeam) {
    return "Faltan datos del partido";
  }

  if (homeTeam === awayTeam) {
    return "Un partido no puede tener el mismo equipo dos veces";
  }

  if (!dayjs(kickoffAt).isValid()) {
    return "La fecha del partido no es válida";
  }

  return null;
}

const officialTeamPresentation = {
  ALG: { name: "Argelia", flag: "\uD83C\uDDE9\uD83C\uDDFF" },
  ARG: { name: "Argentina", flag: "\uD83C\uDDE6\uD83C\uDDF7" },
  AUS: { name: "Australia", flag: "\uD83C\uDDE6\uD83C\uDDFA" },
  AUT: { name: "Austria", flag: "\uD83C\uDDE6\uD83C\uDDF9" },
  BEL: { name: "Bélgica", flag: "\uD83C\uDDE7\uD83C\uDDEA" },
  BIH: { name: "Bosnia y Herzegovina", flag: "\uD83C\uDDE7\uD83C\uDDE6" },
  BRA: { name: "Brasil", flag: "\uD83C\uDDE7\uD83C\uDDF7" },
  CAN: { name: "Canadá", flag: "\uD83C\uDDE8\uD83C\uDDE6" },
  CIV: { name: "Costa de Marfil", flag: "\uD83C\uDDE8\uD83C\uDDEE" },
  COD: { name: "RD Congo", flag: "\uD83C\uDDE8\uD83C\uDDE9" },
  COL: { name: "Colombia", flag: "\uD83C\uDDE8\uD83C\uDDF4" },
  CPV: { name: "Cabo Verde", flag: "\uD83C\uDDE8\uD83C\uDDFB" },
  CRO: { name: "Croacia", flag: "\uD83C\uDDED\uD83C\uDDF7" },
  CUW: { name: "Curazao", flag: "\uD83C\uDDE8\uD83C\uDDFC" },
  CZE: { name: "Chequia", flag: "\uD83C\uDDE8\uD83C\uDDFF" },
  ECU: { name: "Ecuador", flag: "\uD83C\uDDEA\uD83C\uDDE8" },
  EGY: { name: "Egipto", flag: "\uD83C\uDDEA\uD83C\uDDEC" },
  ENG: { name: "Inglaterra", flag: "\uD83C\uDFF4" },
  ESP: { name: "España", flag: "\uD83C\uDDEA\uD83C\uDDF8" },
  FRA: { name: "Francia", flag: "\uD83C\uDDEB\uD83C\uDDF7" },
  GER: { name: "Alemania", flag: "\uD83C\uDDE9\uD83C\uDDEA" },
  GHA: { name: "Ghana", flag: "\uD83C\uDDEC\uD83C\uDDED" },
  HAI: { name: "Haití", flag: "\uD83C\uDDED\uD83C\uDDF9" },
  IRQ: { name: "Irak", flag: "\uD83C\uDDEE\uD83C\uDDF6" },
  IRN: { name: "Irán", flag: "\uD83C\uDDEE\uD83C\uDDF7" },
  JOR: { name: "Jordania", flag: "\uD83C\uDDEF\uD83C\uDDF4" },
  JPN: { name: "Japón", flag: "\uD83C\uDDEF\uD83C\uDDF5" },
  KOR: { name: "República de Corea", flag: "\uD83C\uDDF0\uD83C\uDDF7" },
  KSA: { name: "Arabia Saudí", flag: "\uD83C\uDDF8\uD83C\uDDE6" },
  MAR: { name: "Marruecos", flag: "\uD83C\uDDF2\uD83C\uDDE6" },
  MEX: { name: "México", flag: "\uD83C\uDDF2\uD83C\uDDFD" },
  NED: { name: "Países Bajos", flag: "\uD83C\uDDF3\uD83C\uDDF1" },
  NOR: { name: "Noruega", flag: "\uD83C\uDDF3\uD83C\uDDF4" },
  NZL: { name: "Nueva Zelanda", flag: "\uD83C\uDDF3\uD83C\uDDFF" },
  PAN: { name: "Panamá", flag: "\uD83C\uDDF5\uD83C\uDDE6" },
  PAR: { name: "Paraguay", flag: "\uD83C\uDDF5\uD83C\uDDFE" },
  POR: { name: "Portugal", flag: "\uD83C\uDDF5\uD83C\uDDF9" },
  QAT: { name: "Catar", flag: "\uD83C\uDDF6\uD83C\uDDE6" },
  RSA: { name: "Sudáfrica", flag: "\uD83C\uDDFF\uD83C\uDDE6" },
  SCO: { name: "Escocia", flag: "\uD83C\uDFF4" },
  SEN: { name: "Senegal", flag: "\uD83C\uDDF8\uD83C\uDDF3" },
  SUI: { name: "Suiza", flag: "\uD83C\uDDE8\uD83C\uDDED" },
  SWE: { name: "Suecia", flag: "\uD83C\uDDF8\uD83C\uDDEA" },
  TUN: { name: "Túnez", flag: "\uD83C\uDDF9\uD83C\uDDF3" },
  TUR: { name: "Turquía", flag: "\uD83C\uDDF9\uD83C\uDDF7" },
  URU: { name: "Uruguay", flag: "\uD83C\uDDFA\uD83C\uDDFE" },
  USA: { name: "Estados Unidos", flag: "\uD83C\uDDFA\uD83C\uDDF8" },
  UZB: { name: "Uzbekistán", flag: "\uD83C\uDDFA\uD83C\uDDFF" }
};

function normalizeOfficialTeam(team) {
  const presentation = officialTeamPresentation[team.code];
  return {
    ...team,
    name: presentation?.name ?? team.name,
    flag: presentation?.flag ?? team.flag
  };
}

app.post("/api/auth/register", (req, res) => {
  const { email, password, displayName } = req.body;
  if (!email || !password || !displayName) {
    return res.status(400).json({ error: "Email, password y nombre son obligatorios" });
  }

  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase());
  if (exists) {
    return res.status(409).json({ error: "Ese correo ya está registrado" });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db.prepare("INSERT INTO users (email, password_hash, display_name, role, status) VALUES (?, ?, ?, 'player', 'pending')").run(
    email.toLowerCase(),
    passwordHash,
    displayName.trim()
  );
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
  return res.status(201).json({
    pendingApproval: true,
    message: "Usuario creado. El administrador debe aceptar el alta despues del pago."
  });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email?.toLowerCase());
  if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }
  if (user.role !== "admin" && user.status !== "approved") {
    return res.status(403).json({
      error: user.status === "rejected"
        ? "Tu solicitud ha sido rechazada. Contacta con el administrador."
        : "Tu usuario está pendiente de aprobación por el administrador."
    });
  }
  return res.json({ token: signToken(user), user: getUserPayload(user) });
});

app.get("/api/bootstrap", (_req, res) => {
  return res.json(getPublicTournamentData());
});

app.get("/api/me", authMiddleware, (req, res) => {
  const user = db.prepare("SELECT id, email, display_name, role, status FROM users WHERE id = ?").get(req.user.sub);
  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  const predictions = db.prepare("SELECT * FROM predictions WHERE user_id = ?").all(user.id);
  const qualifiers = db.prepare("SELECT * FROM user_qualifier_predictions WHERE user_id = ?").all(user.id);
  const groupOrders = db.prepare("SELECT * FROM user_group_order_predictions WHERE user_id = ?").all(user.id);
  const bonusAnswers = db.prepare("SELECT * FROM bonus_answers WHERE user_id = ?").all(user.id);

  return res.json({
    user: getUserPayload(user),
    dashboard: getDashboardForUser(user.id),
    predictions,
    qualifiers,
    groupOrders,
    bonusAnswers,
    admin: user.role === "admin" ? getAdminData() : null
  });
});

app.post("/api/predictions", authMiddleware, (req, res) => {
  if (!ensureBetsOpen(res)) {
    return;
  }

  const { matchId, predictedHomeScore, predictedAwayScore } = req.body;
  if ([matchId, predictedHomeScore, predictedAwayScore].some((value) => value === undefined || value === null)) {
    return res.status(400).json({ error: "Faltan datos de la predicción" });
  }

  db.prepare(`
    INSERT INTO predictions (user_id, match_id, predicted_home_score, predicted_away_score, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, match_id)
    DO UPDATE SET
      predicted_home_score = excluded.predicted_home_score,
      predicted_away_score = excluded.predicted_away_score,
      updated_at = CURRENT_TIMESTAMP
  `).run(req.user.sub, matchId, Number(predictedHomeScore), Number(predictedAwayScore));

  return res.json({ ok: true, dashboard: getDashboardForUser(req.user.sub) });
});

app.post("/api/qualifiers", authMiddleware, (req, res) => {
  if (!ensureBetsOpen(res)) {
    return;
  }

  const { groupName, firstTeam, secondTeam } = req.body;
  if (!groupName || !firstTeam || !secondTeam) {
    return res.status(400).json({ error: "Grupo y equipos requeridos" });
  }

  db.prepare(`
    INSERT INTO user_qualifier_predictions (user_id, group_name, first_team, second_team)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, group_name)
    DO UPDATE SET
      first_team = excluded.first_team,
      second_team = excluded.second_team
  `).run(req.user.sub, groupName, firstTeam, secondTeam);

  return res.json({ ok: true, dashboard: getDashboardForUser(req.user.sub) });
});

app.post("/api/group-order", authMiddleware, (req, res) => {
  if (!ensureBetsOpen(res)) {
    return;
  }

  const { groupName, teamOrder } = req.body;
  if (!groupName || !Array.isArray(teamOrder) || teamOrder.length < 2) {
    return res.status(400).json({ error: "Grupo y orden de equipos requeridos" });
  }

  const allowedTeams = db.prepare(`
    SELECT home_team AS team_code
    FROM matches
    WHERE stage = 'groups' AND group_name = ?
    UNION
    SELECT away_team AS team_code
    FROM matches
    WHERE stage = 'groups' AND group_name = ?
  `).all(groupName, groupName).map((row) => row.team_code);
  const allowedSet = new Set(allowedTeams);
  const cleanOrder = [...new Set(teamOrder.map((teamCode) => String(teamCode)))].filter((teamCode) => allowedSet.has(teamCode));

  if (cleanOrder.length !== allowedTeams.length) {
    return res.status(400).json({ error: "El orden debe incluir todos los equipos del grupo" });
  }

  db.prepare(`
    INSERT INTO user_group_order_predictions (user_id, group_name, team_order)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, group_name)
    DO UPDATE SET team_order = excluded.team_order
  `).run(req.user.sub, groupName, JSON.stringify(cleanOrder));

  return res.json({ ok: true, dashboard: getDashboardForUser(req.user.sub) });
});

app.post("/api/bonus", authMiddleware, (req, res) => {
  if (!ensureBetsOpen(res)) {
    return;
  }

  const { questionKey, answerValue } = req.body;
  if (!questionKey || !answerValue) {
    return res.status(400).json({ error: "Pregunta y respuesta requeridas" });
  }
  const cleanAnswer = String(answerValue).trim().replace(/\s+/g, " ");
  if (!cleanAnswer) {
    return res.status(400).json({ error: "Respuesta requerida" });
  }

  db.prepare(`
    INSERT INTO bonus_answers (user_id, question_key, answer_value)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, question_key)
    DO UPDATE SET answer_value = excluded.answer_value
  `).run(req.user.sub, questionKey, cleanAnswer);

  return res.json({ ok: true, dashboard: getDashboardForUser(req.user.sub) });
});

app.get("/api/leaderboard", authMiddleware, (_req, res) => {
  return res.json({ leaderboard: getLeaderboard() });
});

app.get("/api/admin", authMiddleware, adminMiddleware, (_req, res) => {
  return res.json({ admin: getAdminData() });
});

app.post("/api/admin/matches/:id/result", authMiddleware, adminMiddleware, (req, res) => {
  const matchId = Number(req.params.id);
  const { actualHomeScore, actualAwayScore } = req.body;
  if ([actualHomeScore, actualAwayScore].some((value) => value === undefined || value === null)) {
    return res.status(400).json({ error: "Resultado incompleto" });
  }

  db.prepare(`
    UPDATE matches
    SET actual_home_score = ?, actual_away_score = ?
    WHERE id = ?
  `).run(Number(actualHomeScore), Number(actualAwayScore), matchId);

  return res.json({ ok: true, admin: getAdminData(), leaderboard: getLeaderboard() });
});

app.post("/api/admin/matches", authMiddleware, adminMiddleware, (req, res) => {
  const { stage, groupName, kickoffAt, homeTeam, awayTeam } = req.body;
  const validationError = validateMatchPayload({ stage, kickoffAt, homeTeam, awayTeam });
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  db.prepare(`
    INSERT INTO matches (match_number, stage, group_name, kickoff_at, home_team, away_team, actual_home_score, actual_away_score)
    VALUES (NULL, ?, ?, ?, ?, ?, NULL, NULL)
  `).run(stage, groupName || null, kickoffAt, homeTeam, awayTeam);

  return res.status(201).json({ ok: true, admin: getAdminData(), settings: getTournamentSettings() });
});

app.put("/api/admin/matches/:id", authMiddleware, adminMiddleware, (req, res) => {
  const matchId = Number(req.params.id);
  const { stage, groupName, kickoffAt, homeTeam, awayTeam } = req.body;
  const validationError = validateMatchPayload({ stage, kickoffAt, homeTeam, awayTeam });
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  db.prepare(`
    UPDATE matches
    SET stage = ?, group_name = ?, kickoff_at = ?, home_team = ?, away_team = ?
    WHERE id = ?
  `).run(stage, groupName || null, kickoffAt, homeTeam, awayTeam, matchId);

  return res.json({ ok: true, admin: getAdminData(), settings: getTournamentSettings() });
});

app.delete("/api/admin/matches/:id", authMiddleware, adminMiddleware, (req, res) => {
  const matchId = Number(req.params.id);

  db.transaction(() => {
    db.prepare("DELETE FROM predictions WHERE match_id = ?").run(matchId);
    db.prepare("DELETE FROM matches WHERE id = ?").run(matchId);
  })();

  return res.json({ ok: true, admin: getAdminData(), settings: getTournamentSettings(), leaderboard: getLeaderboard() });
});

app.post("/api/admin/import-official-schedule", authMiddleware, adminMiddleware, (_req, res) => {
  const importOfficialSchedule = db.transaction(() => {
    db.prepare("DELETE FROM predictions").run();
    db.prepare("DELETE FROM user_qualifier_predictions").run();
    db.prepare("DELETE FROM user_group_order_predictions").run();
    db.prepare("DELETE FROM official_group_order").run();
    db.prepare("DELETE FROM stage_qualifiers").run();
    db.prepare("DELETE FROM matches").run();

    const upsertTeam = db.prepare(`
      INSERT INTO teams (code, name, flag, confederation)
      VALUES (@code, @name, @flag, @confederation)
      ON CONFLICT(code) DO UPDATE SET
        name = excluded.name,
        flag = excluded.flag,
        confederation = excluded.confederation
    `);

    for (const team of officialTeams) {
      upsertTeam.run(normalizeOfficialTeam(team));
    }

    const insertMatch = db.prepare(`
      INSERT INTO matches (match_number, stage, group_name, kickoff_at, home_team, away_team, actual_home_score, actual_away_score)
      VALUES (@match_number, @stage, @group_name, @kickoff_at, @home_team, @away_team, NULL, NULL)
    `);

    for (const match of officialMatches) {
      insertMatch.run(match);
    }
  });

  importOfficialSchedule();

  return res.json({
    ok: true,
    admin: getAdminData(),
    settings: getTournamentSettings(),
    tournament: getPublicTournamentData(),
    leaderboard: getLeaderboard()
  });
});

app.post("/api/admin/bonus-result", authMiddleware, adminMiddleware, (req, res) => {
  const { questionKey, correctValue } = req.body;
  if (!questionKey || !correctValue) {
    return res.status(400).json({ error: "Pregunta y valor correcto requeridos" });
  }
  const cleanValue = String(correctValue).trim().replace(/\s+/g, " ");
  if (!cleanValue) {
    return res.status(400).json({ error: "Valor correcto requerido" });
  }

  db.prepare(`
    INSERT INTO bonus_results (question_key, correct_value)
    VALUES (?, ?)
    ON CONFLICT(question_key)
    DO UPDATE SET correct_value = excluded.correct_value
  `).run(questionKey, cleanValue);

  return res.json({ ok: true, admin: getAdminData(), leaderboard: getLeaderboard() });
});

app.post("/api/admin/group-order", authMiddleware, adminMiddleware, (req, res) => {
  const { groupName, teamOrder } = req.body;
  if (!groupName || !Array.isArray(teamOrder) || teamOrder.length < 2) {
    return res.status(400).json({ error: "Grupo y orden de equipos requeridos" });
  }

  const allowedTeams = db.prepare(`
    SELECT home_team AS team_code
    FROM matches
    WHERE stage = 'groups' AND group_name = ?
    UNION
    SELECT away_team AS team_code
    FROM matches
    WHERE stage = 'groups' AND group_name = ?
  `).all(groupName, groupName).map((row) => row.team_code);
  const allowedSet = new Set(allowedTeams);
  const cleanOrder = [...new Set(teamOrder.map((teamCode) => String(teamCode)))].filter((teamCode) => allowedSet.has(teamCode));

  if (cleanOrder.length !== allowedTeams.length) {
    return res.status(400).json({ error: "El orden debe incluir todos los equipos del grupo" });
  }

  db.prepare(`
    INSERT INTO official_group_order (group_name, team_order)
    VALUES (?, ?)
    ON CONFLICT(group_name)
    DO UPDATE SET team_order = excluded.team_order
  `).run(groupName, JSON.stringify(cleanOrder));

  return res.json({ ok: true, admin: getAdminData(), leaderboard: getLeaderboard() });
});

app.post("/api/admin/users/:id/status", authMiddleware, adminMiddleware, async (req, res) => {
  const userId = Number(req.params.id);
  const { status } = req.body;
  if (!["approved", "rejected", "pending"].includes(status)) {
    return res.status(400).json({ error: "Estado no válido" });
  }

  const user = db.prepare("SELECT id, email, display_name, role, status FROM users WHERE id = ?").get(userId);
  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }
  if (user.role === "admin" && status !== "approved") {
    return res.status(400).json({ error: "No se puede bloquear un administrador desde este panel" });
  }

  db.prepare("UPDATE users SET status = ? WHERE id = ?").run(status, userId);
  const updatedUser = db.prepare("SELECT id, email, display_name, role, status FROM users WHERE id = ?").get(userId);
  let mail = { sent: false };
  if (status === "approved" || status === "rejected") {
    mail = await sendAccountDecisionEmail({
      to: updatedUser.email,
      displayName: updatedUser.display_name,
      status
    });
  }

  return res.json({ ok: true, admin: getAdminData(), leaderboard: getLeaderboard(), mail });
});

app.post("/api/admin/users", authMiddleware, adminMiddleware, async (req, res) => {
  const { email, password, displayName, role = "player", status = "approved" } = req.body;
  if (!email || !password || !displayName) {
    return res.status(400).json({ error: "Email, password y nombre son obligatorios" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });
  }
  if (!["player", "admin"].includes(role) || !["pending", "approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Rol o estado no válido" });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail);
  if (exists) {
    return res.status(409).json({ error: "Ese correo ya está registrado" });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  db.prepare("INSERT INTO users (email, password_hash, display_name, role, status) VALUES (?, ?, ?, ?, ?)").run(
    normalizedEmail,
    passwordHash,
    displayName.trim(),
    role,
    role === "admin" ? "approved" : status
  );

  return res.status(201).json({ ok: true, admin: getAdminData(), leaderboard: getLeaderboard() });
});

app.put("/api/admin/users/:id", authMiddleware, adminMiddleware, (req, res) => {
  const userId = Number(req.params.id);
  const { email, displayName, role, status } = req.body;
  if (!email || !displayName || !role || !status) {
    return res.status(400).json({ error: "Email, nombre, rol y estado son obligatorios" });
  }
  if (!["player", "admin"].includes(role) || !["pending", "approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Rol o estado no válido" });
  }

  const user = db.prepare("SELECT id, role FROM users WHERE id = ?").get(userId);
  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const duplicated = db.prepare("SELECT id FROM users WHERE email = ? AND id <> ?").get(normalizedEmail, userId);
  if (duplicated) {
    return res.status(409).json({ error: "Ese correo ya está registrado" });
  }

  const nextStatus = role === "admin" ? "approved" : status;
  db.prepare("UPDATE users SET email = ?, display_name = ?, role = ?, status = ? WHERE id = ?").run(
    normalizedEmail,
    displayName.trim(),
    role,
    nextStatus,
    userId
  );

  return res.json({ ok: true, admin: getAdminData(), leaderboard: getLeaderboard() });
});

app.post("/api/admin/users/:id/reset-password", authMiddleware, adminMiddleware, (req, res) => {
  const userId = Number(req.params.id);
  const { password } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).json({ error: "La nueva contraseña debe tener al menos 8 caracteres" });
  }

  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);

  return res.json({ ok: true, admin: getAdminData() });
});

app.delete("/api/admin/users/:id", authMiddleware, adminMiddleware, (req, res) => {
  const userId = Number(req.params.id);
  if (userId === req.user.sub) {
    return res.status(400).json({ error: "No puedes borrar tu propio usuario" });
  }

  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  db.transaction(() => {
    db.prepare("DELETE FROM predictions WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM user_qualifier_predictions WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM user_group_order_predictions WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM bonus_answers WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  })();

  return res.json({ ok: true, admin: getAdminData(), leaderboard: getLeaderboard() });
});

app.post("/api/admin/qualifiers/:groupName", authMiddleware, adminMiddleware, (req, res) => {
  const groupName = req.params.groupName;
  const { firstTeam, secondTeam } = req.body;
  if (!groupName || !firstTeam || !secondTeam) {
    return res.status(400).json({ error: "Grupo y dos equipos requeridos" });
  }

  db.transaction(() => {
    db.prepare("DELETE FROM stage_qualifiers WHERE group_name = ?").run(groupName);
    db.prepare("INSERT INTO stage_qualifiers (group_name, team_code) VALUES (?, ?)").run(groupName, firstTeam);
    db.prepare("INSERT INTO stage_qualifiers (group_name, team_code) VALUES (?, ?)").run(groupName, secondTeam);
  })();

  return res.json({ ok: true, admin: getAdminData(), leaderboard: getLeaderboard() });
});

app.post("/api/admin/send-digest", authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const result = await sendDailyDigestToAllUsers();
    return res.json({ ok: true, result });
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo enviar el resumen" });
  }
});

const clientDist = path.resolve("client", "dist");
app.use(express.static(clientDist));

app.get("/{*any}", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Porra Mundial disponible en http://0.0.0.0:${port}`);
});
