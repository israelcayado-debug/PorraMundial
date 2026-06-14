import dayjs from "dayjs";
import { db, tournamentConfig } from "./db.js";

const STAGE_LABELS = {
  groups: "Fase de grupos",
  round_of_32: "Dieciseisavos",
  round_of_16: "Octavos",
  quarterfinals: "Cuartos",
  semifinals: "Semifinales",
  third_place: "Tercer puesto",
  final: "Final"
};

const PLAYER_COLORS = ["#3cccf4", "#ffd166", "#95e06c", "#ff6fb5", "#f78c6b", "#b8f7d4", "#f6e05e", "#7dd3fc"];

const BRACKET_STAGE_POINTS = {
  round_of_32: { label: "Equipos en dieciseisavos", exact: 5, elsewhere: 3, mode: "slot" },
  round_of_16: { label: "Equipos en octavos", team: 6, mode: "team" },
  quarterfinals: { label: "Equipos en cuartos", team: 7, mode: "team" },
  semifinals: { label: "Equipos en semifinales", team: 8, mode: "team" },
  third_place: { label: "Equipos en tercer y cuarto puesto", team: 9, mode: "team" },
  final: { label: "Finalistas", team: 10, mode: "team" }
};

function hashString(value) {
  return [...value].reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

function getPlayerIdentity(user) {
  const initials = user.display_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
  const color = PLAYER_COLORS[Math.abs(hashString(`${user.id}:${user.email}`)) % PLAYER_COLORS.length];

  return { initials, color };
}

function getMatchOutcome(homeScore, awayScore) {
  if (homeScore === awayScore) {
    return "draw";
  }
  return homeScore > awayScore ? "home" : "away";
}

function getWinnerCode(homeScore, awayScore, homeCode, awayCode) {
  if (homeScore === null || awayScore === null || homeScore === awayScore) {
    return null;
  }

  return homeScore > awayScore ? homeCode : awayCode;
}

function getLoserCode(homeScore, awayScore, homeCode, awayCode) {
  if (homeScore === null || awayScore === null || homeScore === awayScore) {
    return null;
  }

  return homeScore > awayScore ? awayCode : homeCode;
}

function getPredictedOutcome(prediction) {
  if (!prediction) {
    return null;
  }

  if (prediction.predicted_home_score === prediction.predicted_away_score) {
    return "draw";
  }

  return prediction.predicted_home_score > prediction.predicted_away_score ? "home" : "away";
}

function getOutcomeLabel(outcome) {
  if (outcome === "home") {
    return "1";
  }
  if (outcome === "away") {
    return "2";
  }
  if (outcome === "draw") {
    return "X";
  }
  return "-";
}

function normalizeAnswer(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildGroupRankMap(rows, firstKey, secondKey) {
  const map = new Map();

  for (const row of rows) {
    if (row[firstKey]) {
      map.set(`1${row.group_name}`, row[firstKey]);
    }
    if (row[secondKey]) {
      map.set(`2${row.group_name}`, row[secondKey]);
    }
  }

  return map;
}

function parseTeamOrder(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return String(value).split(",").map((teamCode) => teamCode.trim()).filter(Boolean);
  }
}

function buildGroupOrderMap(userGroupOrders) {
  return new Map(userGroupOrders.map((row) => [row.group_name, parseTeamOrder(row.team_order)]));
}

function buildPredictedGroupRankMap(matches, userPredictions, userGroupOrders = []) {
  const predictionsByMatch = new Map(userPredictions.map((prediction) => [prediction.match_id, prediction]));
  const groupOrderMap = buildGroupOrderMap(userGroupOrders);
  const groupTeams = new Map();
  const groupMatchCounts = new Map();
  const groupPredictedCounts = new Map();
  const standings = new Map();

  for (const match of matches) {
    if (match.stage !== "groups" || !match.group_name) {
      continue;
    }

    groupTeams.set(match.group_name, [...new Set([...(groupTeams.get(match.group_name) ?? []), match.home_team, match.away_team])]);
    groupMatchCounts.set(match.group_name, (groupMatchCounts.get(match.group_name) ?? 0) + 1);

    if (!standings.has(match.group_name)) {
      standings.set(match.group_name, new Map());
    }

    const groupStanding = standings.get(match.group_name);
    groupStanding.set(match.home_team, groupStanding.get(match.home_team) ?? 0);
    groupStanding.set(match.away_team, groupStanding.get(match.away_team) ?? 0);

    const outcome = getPredictedOutcome(predictionsByMatch.get(match.id));
    if (outcome) {
      groupPredictedCounts.set(match.group_name, (groupPredictedCounts.get(match.group_name) ?? 0) + 1);
    }

    if (outcome === "home") {
      groupStanding.set(match.home_team, groupStanding.get(match.home_team) + 3);
    } else if (outcome === "away") {
      groupStanding.set(match.away_team, groupStanding.get(match.away_team) + 3);
    } else if (outcome === "draw") {
      groupStanding.set(match.home_team, groupStanding.get(match.home_team) + 1);
      groupStanding.set(match.away_team, groupStanding.get(match.away_team) + 1);
    }
  }

  const map = new Map();
  const thirdRanking = [];

  for (const [groupName, groupStanding] of standings.entries()) {
    if ((groupPredictedCounts.get(groupName) ?? 0) < (groupMatchCounts.get(groupName) ?? 0)) {
      continue;
    }

    const originalOrder = groupTeams.get(groupName) ?? [];
    const manualOrder = groupOrderMap.get(groupName) ?? [];
    const sortedTeams = [...groupStanding.entries()]
      .sort((a, b) => {
        const pointsDiff = b[1] - a[1];
        if (pointsDiff !== 0) {
          return pointsDiff;
        }

        const manualA = manualOrder.indexOf(a[0]);
        const manualB = manualOrder.indexOf(b[0]);
        if (manualA !== -1 && manualB !== -1 && manualA !== manualB) {
          return manualA - manualB;
        }

        return originalOrder.indexOf(a[0]) - originalOrder.indexOf(b[0]);
      })
      .map(([teamCode, points]) => ({ teamCode, points }));

    if (sortedTeams[0]?.teamCode) {
      map.set(`1${groupName}`, sortedTeams[0].teamCode);
    }
    if (sortedTeams[1]?.teamCode) {
      map.set(`2${groupName}`, sortedTeams[1].teamCode);
    }
    if (sortedTeams[2]?.teamCode) {
      map.set(`3${groupName}`, sortedTeams[2].teamCode);
      thirdRanking.push({
        groupName,
        teamCode: sortedTeams[2].teamCode,
        points: sortedTeams[2].points
      });
    }
  }

  map.set("__thirdRanking", thirdRanking.sort((a, b) => b.points - a.points || a.groupName.localeCompare(b.groupName)));
  return map;
}

function buildActualGroupRankMap(actualQualifiers, matches, officialGroupOrders = []) {
  const map = new Map();
  const groupOrderMap = buildGroupOrderMap(officialGroupOrders);

  const groupTeams = new Map();
  const groupMatchCounts = new Map();
  const groupCompletedCounts = new Map();
  const standings = new Map();

  for (const match of matches) {
    if (match.stage !== "groups" || !match.group_name) {
      continue;
    }

    groupTeams.set(match.group_name, [...new Set([...(groupTeams.get(match.group_name) ?? []), match.home_team, match.away_team])]);
    groupMatchCounts.set(match.group_name, (groupMatchCounts.get(match.group_name) ?? 0) + 1);

    if (!standings.has(match.group_name)) {
      standings.set(match.group_name, new Map());
    }

    const groupStanding = standings.get(match.group_name);
    groupStanding.set(match.home_team, groupStanding.get(match.home_team) ?? 0);
    groupStanding.set(match.away_team, groupStanding.get(match.away_team) ?? 0);

    if (match.actual_home_score === null || match.actual_away_score === null) {
      continue;
    }

    groupCompletedCounts.set(match.group_name, (groupCompletedCounts.get(match.group_name) ?? 0) + 1);
    const outcome = getMatchOutcome(match.actual_home_score, match.actual_away_score);
    if (outcome === "home") {
      groupStanding.set(match.home_team, groupStanding.get(match.home_team) + 3);
    } else if (outcome === "away") {
      groupStanding.set(match.away_team, groupStanding.get(match.away_team) + 3);
    } else {
      groupStanding.set(match.home_team, groupStanding.get(match.home_team) + 1);
      groupStanding.set(match.away_team, groupStanding.get(match.away_team) + 1);
    }
  }

  const thirdRanking = [];
  for (const [groupName, groupStanding] of standings.entries()) {
    if ((groupCompletedCounts.get(groupName) ?? 0) < (groupMatchCounts.get(groupName) ?? 0)) {
      continue;
    }

    const originalOrder = groupTeams.get(groupName) ?? [];
    const manualOrder = groupOrderMap.get(groupName) ?? [];
    const sortedTeams = [...groupStanding.entries()]
      .sort((a, b) => {
        const pointsDiff = b[1] - a[1];
        if (pointsDiff !== 0) {
          return pointsDiff;
        }

        const manualA = manualOrder.indexOf(a[0]);
        const manualB = manualOrder.indexOf(b[0]);
        if (manualA !== -1 && manualB !== -1 && manualA !== manualB) {
          return manualA - manualB;
        }

        return originalOrder.indexOf(a[0]) - originalOrder.indexOf(b[0]);
      })
      .map(([teamCode, points]) => ({ teamCode, points }));

    if (sortedTeams[0]?.teamCode) {
      map.set(`1${groupName}`, sortedTeams[0].teamCode);
    }
    if (sortedTeams[1]?.teamCode) {
      map.set(`2${groupName}`, sortedTeams[1].teamCode);
    }
    if (sortedTeams[2]?.teamCode) {
      map.set(`3${groupName}`, sortedTeams[2].teamCode);
      thirdRanking.push({
        groupName,
        teamCode: sortedTeams[2].teamCode,
        points: sortedTeams[2].points
      });
    }
  }

  map.set("__thirdRanking", thirdRanking.sort((a, b) => b.points - a.points || a.groupName.localeCompare(b.groupName)));
  return map;
}

function resolveBracketToken(token, contextMatch, { matchesByNumber, predictionsByMatch, groupRankMap, teamCodes, mode }) {
  const cache = new Map();

  const resolve = (currentToken, currentContext) => {
    if (!currentToken) {
      return null;
    }

    const cacheKey = `${currentContext?.match_number || currentContext?.id || "x"}:${currentToken}`;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    if (teamCodes.has(currentToken)) {
      cache.set(cacheKey, currentToken);
      return currentToken;
    }

    if (/^[12][A-L]$/.test(currentToken)) {
      const rankedTeam = groupRankMap.get(currentToken) ?? null;
      cache.set(cacheKey, rankedTeam);
      return rankedTeam;
    }

    if (currentToken === "3") {
      const eligibleGroups = (currentContext?.group_name || "").split("");
      const thirdRanking = groupRankMap.get("__thirdRanking") ?? [];
      const rankedThird = thirdRanking.find((entry) => eligibleGroups.includes(entry.groupName))?.teamCode ?? null;
      cache.set(cacheKey, rankedThird);
      return rankedThird;
    }

    const winnerToken = /^W(\d+)$/.exec(currentToken);
    if (winnerToken) {
      const previousMatch = matchesByNumber.get(Number(winnerToken[1]));
      if (!previousMatch) {
        cache.set(cacheKey, null);
        return null;
      }

      const homeCode = resolve(previousMatch.home_team, previousMatch);
      const awayCode = resolve(previousMatch.away_team, previousMatch);
      const source = mode === "prediction" ? predictionsByMatch.get(previousMatch.id) : previousMatch;
      const homeScore = mode === "prediction" ? source?.predicted_home_score : source?.actual_home_score;
      const awayScore = mode === "prediction" ? source?.predicted_away_score : source?.actual_away_score;
      const resolved = getWinnerCode(homeScore ?? null, awayScore ?? null, homeCode, awayCode);
      cache.set(cacheKey, resolved);
      return resolved;
    }

    const loserToken = /^L(\d+)$/.exec(currentToken);
    if (loserToken) {
      const previousMatch = matchesByNumber.get(Number(loserToken[1]));
      if (!previousMatch) {
        cache.set(cacheKey, null);
        return null;
      }

      const homeCode = resolve(previousMatch.home_team, previousMatch);
      const awayCode = resolve(previousMatch.away_team, previousMatch);
      const source = mode === "prediction" ? predictionsByMatch.get(previousMatch.id) : previousMatch;
      const homeScore = mode === "prediction" ? source?.predicted_home_score : source?.actual_home_score;
      const awayScore = mode === "prediction" ? source?.predicted_away_score : source?.actual_away_score;
      const resolved = getLoserCode(homeScore ?? null, awayScore ?? null, homeCode, awayCode);
      cache.set(cacheKey, resolved);
      return resolved;
    }

    cache.set(cacheKey, null);
    return null;
  };

  return resolve(token, contextMatch);
}

function buildThirdPlaceAssignments(matches, groupRankMap) {
  const thirdRanking = groupRankMap.get("__thirdRanking") ?? [];
  const usedTeams = new Set();
  const assignments = new Map();

  for (const match of matches.filter((item) => item.stage === "round_of_32").sort((a, b) => (a.match_number || a.id) - (b.match_number || b.id))) {
    for (const side of ["home_team", "away_team"]) {
      if (match[side] !== "3") {
        continue;
      }

      const eligibleGroups = (match.group_name || "").split("");
      const assigned = thirdRanking.find((entry) => eligibleGroups.includes(entry.groupName) && !usedTeams.has(entry.teamCode));
      if (assigned?.teamCode) {
        assignments.set(`${match.id}:${side}`, assigned.teamCode);
        usedTeams.add(assigned.teamCode);
      }
    }
  }

  return assignments;
}

function buildStageSlots(stage, matches, resolver) {
  return matches
    .filter((match) => match.stage === stage)
    .flatMap((match) => [
      {
        slot: `${match.match_number || match.id}:home`,
        teamCode: resolver(match.home_team, match)
      },
      {
        slot: `${match.match_number || match.id}:away`,
        teamCode: resolver(match.away_team, match)
      }
    ])
    .filter((slot) => Boolean(slot.teamCode));
}

function countSharedTeams(predictedSlots, actualSlots) {
  const actualTeams = new Set(actualSlots.map((slot) => slot.teamCode));
  return predictedSlots.filter((slot) => actualTeams.has(slot.teamCode)).length;
}

function scoreStageBySlot(predictedSlots, actualSlots, config) {
  const actualBySlot = new Map(actualSlots.map((slot) => [slot.slot, slot.teamCode]));
  const actualTeams = new Set(actualSlots.map((slot) => slot.teamCode));
  let exactHits = 0;
  let elsewhereHits = 0;

  for (const predictedSlot of predictedSlots) {
    if (actualBySlot.get(predictedSlot.slot) === predictedSlot.teamCode) {
      exactHits += 1;
    } else if (actualTeams.has(predictedSlot.teamCode)) {
      elsewhereHits += 1;
    }
  }

  return {
    exactHits,
    elsewhereHits,
    points: exactHits * config.exact + elsewhereHits * config.elsewhere
  };
}

function scoreStageByTeam(predictedSlots, actualSlots, pointsPerTeam) {
  const hits = countSharedTeams(predictedSlots, actualSlots);
  return {
    exactHits: hits,
    elsewhereHits: 0,
    points: hits * pointsPerTeam
  };
}

function getResolvedMatchWinner(match, resolver, predictionsByMatch, mode) {
  if (!match) {
    return null;
  }

  const resolvedHome = resolver(match.home_team, match);
  const resolvedAway = resolver(match.away_team, match);
  const source = mode === "prediction" ? predictionsByMatch.get(match.id) : match;
  const homeScore = mode === "prediction" ? source?.predicted_home_score : source?.actual_home_score;
  const awayScore = mode === "prediction" ? source?.predicted_away_score : source?.actual_away_score;
  return getWinnerCode(homeScore ?? null, awayScore ?? null, resolvedHome, resolvedAway);
}

function scoreBracketProgression({ matches, teams, userPredictions, userQualifiers, userGroupOrders = [], actualQualifiers, officialGroupOrders = [] }) {
  const teamCodes = new Set(teams.map((team) => team.code));
  const matchesByNumber = new Map(matches.filter((match) => match.match_number).map((match) => [match.match_number, match]));
  const predictionsByMatch = new Map(userPredictions.map((prediction) => [prediction.match_id, prediction]));
  const predictedGroupRankMap = buildPredictedGroupRankMap(matches, userPredictions, userGroupOrders);
  const actualGroupRankMap = buildActualGroupRankMap(actualQualifiers, matches, officialGroupOrders);
  const predictedThirdAssignments = buildThirdPlaceAssignments(matches, predictedGroupRankMap);
  const actualThirdAssignments = buildThirdPlaceAssignments(matches, actualGroupRankMap);

  const predictedResolver = (token, match) => {
    if (token === "3") {
      const side = match?.home_team === "3" ? "home_team" : match?.away_team === "3" ? "away_team" : null;
      return side ? predictedThirdAssignments.get(`${match.id}:${side}`) ?? null : null;
    }

    return resolveBracketToken(token, match, {
    matchesByNumber,
    predictionsByMatch,
    groupRankMap: predictedGroupRankMap,
    teamCodes,
    mode: "prediction"
    });
  };

  const actualResolver = (token, match) => {
    if (token === "3") {
      const side = match?.home_team === "3" ? "home_team" : match?.away_team === "3" ? "away_team" : null;
      return side ? actualThirdAssignments.get(`${match.id}:${side}`) ?? null : null;
    }

    return resolveBracketToken(token, match, {
    matchesByNumber,
    predictionsByMatch: new Map(),
    groupRankMap: actualGroupRankMap,
    teamCodes,
    mode: "actual"
    });
  };

  const details = [];
  let points = 0;
  const tieBreak = {
    championHit: 0,
    finalTeamHits: 0,
    semifinalTeamHits: 0,
    quarterfinalTeamHits: 0,
    roundOf16TeamHits: 0,
    roundOf32TeamHits: 0
  };

  for (const [stage, config] of Object.entries(BRACKET_STAGE_POINTS)) {
    const predictedSlots = buildStageSlots(stage, matches, predictedResolver);
    const actualSlots = buildStageSlots(stage, matches, actualResolver);
    const stageScore = config.mode === "slot"
      ? scoreStageBySlot(predictedSlots, actualSlots, config)
      : scoreStageByTeam(predictedSlots, actualSlots, config.team);

    points += stageScore.points;

    details.push({
      stage,
      label: config.label,
      exactHits: stageScore.exactHits,
      elsewhereHits: stageScore.elsewhereHits,
      points: stageScore.points,
      exactPoints: config.exact ?? config.team,
      elsewherePoints: config.elsewhere ?? 0
    });
  }

  const finalMatch = matches.find((match) => match.stage === "final");
  if (finalMatch) {
    const predictedFinalWinner = getResolvedMatchWinner(finalMatch, predictedResolver, predictionsByMatch, "prediction");
    const actualFinalWinner = getResolvedMatchWinner(finalMatch, actualResolver, predictionsByMatch, "actual");
    if (predictedFinalWinner && actualFinalWinner && predictedFinalWinner === actualFinalWinner) {
      points += 12;
      tieBreak.championHit = 1;
      details.push({
        stage: "champion",
        label: "Campeón",
        exactHits: 1,
        elsewhereHits: 0,
        points: 12,
        exactPoints: 12,
        elsewherePoints: 0
      });
    }
  }

  const thirdPlaceMatch = matches.find((match) => match.stage === "third_place");
  if (thirdPlaceMatch) {
    const predictedThirdPlaceWinner = getResolvedMatchWinner(thirdPlaceMatch, predictedResolver, predictionsByMatch, "prediction");
    const actualThirdPlaceWinner = getResolvedMatchWinner(thirdPlaceMatch, actualResolver, predictionsByMatch, "actual");
    if (predictedThirdPlaceWinner && actualThirdPlaceWinner && predictedThirdPlaceWinner === actualThirdPlaceWinner) {
      points += 10;
      details.push({
        stage: "third_place_winner",
        label: "Tercer clasificado",
        exactHits: 1,
        elsewhereHits: 0,
        points: 10,
        exactPoints: 10,
        elsewherePoints: 0
      });
    }
  }

  tieBreak.finalTeamHits = countSharedTeams(buildStageSlots("final", matches, predictedResolver), buildStageSlots("final", matches, actualResolver));
  tieBreak.semifinalTeamHits = countSharedTeams(buildStageSlots("semifinals", matches, predictedResolver), buildStageSlots("semifinals", matches, actualResolver));
  tieBreak.quarterfinalTeamHits = countSharedTeams(buildStageSlots("quarterfinals", matches, predictedResolver), buildStageSlots("quarterfinals", matches, actualResolver));
  tieBreak.roundOf16TeamHits = countSharedTeams(buildStageSlots("round_of_16", matches, predictedResolver), buildStageSlots("round_of_16", matches, actualResolver));
  tieBreak.roundOf32TeamHits = countSharedTeams(buildStageSlots("round_of_32", matches, predictedResolver), buildStageSlots("round_of_32", matches, actualResolver));

  return { points, details, tieBreak };
}

function scorePrediction(prediction, match) {
  if (match.actual_home_score === null || match.actual_away_score === null) {
    return { points: 0, reason: "Pendiente" };
  }

  if (match.stage !== "groups") {
    return { points: 0, reason: "Puntuación por cuadro" };
  }

  const predictedOutcome = getMatchOutcome(prediction.predicted_home_score, prediction.predicted_away_score);
  const actualOutcome = getMatchOutcome(match.actual_home_score, match.actual_away_score);

  if (predictedOutcome === actualOutcome) {
    return { points: 2, reason: "Resultado 1/X/2" };
  }

  return { points: 0, reason: "Sin acierto" };
}

function scoreGroupPerfectBonuses(matches, userPredictions) {
  const predictionsByMatch = new Map(userPredictions.map((prediction) => [prediction.match_id, prediction]));
  const groups = Object.groupBy(matches.filter((match) => match.stage === "groups" && match.group_name), ({ group_name }) => group_name);
  let points = 0;
  const details = [];

  for (const [groupName, groupMatches] of Object.entries(groups)) {
    const isComplete = groupMatches.every((match) => match.actual_home_score !== null && match.actual_away_score !== null);
    if (!isComplete) {
      continue;
    }

    const allCorrect = groupMatches.every((match) => {
      const prediction = predictionsByMatch.get(match.id);
      if (!prediction) {
        return false;
      }
      return getPredictedOutcome(prediction) === getMatchOutcome(match.actual_home_score, match.actual_away_score);
    });

    if (allCorrect) {
      points += 8;
      details.push({ groupName, points: 8 });
    }
  }

  return { points, details };
}

function buildTrajectory(sortedRows) {
  return sortedRows.map((entry, index) => ({
    date: dayjs(entry.kickoff_at).format("DD MMM"),
    total: entry.running_total,
    position: index + 1
  }));
}

function buildRankingHistory(users, completedMatches, predictionsByUser) {
  const totalsByUser = new Map(users.map((user) => [user.id, { total: 0, exactHits: 0, lastPoints: 0 }]));
  const historyByUser = new Map(users.map((user) => [user.id, []]));

  for (const match of completedMatches) {
    for (const user of users) {
      const current = totalsByUser.get(user.id);
      current.lastPoints = 0;
      const prediction = (predictionsByUser[user.id] ?? []).find((item) => item.match_id === match.id);
      if (!prediction) {
        continue;
      }

      const score = scorePrediction(prediction, match);
      current.total += score.points;
      current.lastPoints = score.points;
      if (score.points === 5) {
        current.exactHits += 1;
      }
    }

    const rankedSnapshot = users
      .map((user) => ({
        userId: user.id,
        displayName: user.display_name,
        total: totalsByUser.get(user.id).total,
        matchPoints: totalsByUser.get(user.id).lastPoints,
        exactHits: totalsByUser.get(user.id).exactHits
      }))
      .sort((a, b) => b.total - a.total || b.exactHits - a.exactHits || a.displayName.localeCompare(b.displayName))
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    for (const entry of rankedSnapshot) {
      historyByUser.get(entry.userId).push({
        date: dayjs(match.kickoff_at).format("DD MMM"),
        matchNumber: match.match_number,
        homeTeam: match.home_team,
        awayTeam: match.away_team,
        matchPoints: entry.matchPoints,
        total: entry.total,
        rank: entry.rank
      });
    }
  }

  return historyByUser;
}

function buildRecentResults(userId) {
  const rows = db.prepare(`
    SELECT
      m.id AS match_id,
      m.match_number,
      m.stage,
      m.kickoff_at,
      m.home_team,
      m.away_team,
      m.actual_home_score,
      m.actual_away_score,
      p.predicted_home_score,
      p.predicted_away_score
    FROM predictions p
    JOIN matches m ON m.id = p.match_id
    WHERE p.user_id = ?
      AND m.actual_home_score IS NOT NULL
      AND m.actual_away_score IS NOT NULL
    ORDER BY datetime(m.kickoff_at) DESC
  `).all(userId);

  return rows.map((row) => {
    const score = scorePrediction(row, row);
    return {
      matchId: row.match_id,
      matchNumber: row.match_number,
      stage: row.stage,
      stageLabel: STAGE_LABELS[row.stage] ?? row.stage,
      kickoffAt: row.kickoff_at,
      homeTeam: row.home_team,
      awayTeam: row.away_team,
      predictedHomeScore: row.predicted_home_score,
      predictedAwayScore: row.predicted_away_score,
      actualHomeScore: row.actual_home_score,
      actualAwayScore: row.actual_away_score,
      predictedOutcome: getOutcomeLabel(getPredictedOutcome(row)),
      actualOutcome: getOutcomeLabel(getMatchOutcome(row.actual_home_score, row.actual_away_score)),
      points: score.points,
      reason: score.reason
    };
  });
}

function compareLeaderboardRows(a, b) {
  return b.totalPoints - a.totalPoints
    || b.tieBreak.championHit - a.tieBreak.championHit
    || b.tieBreak.topScorerHit - a.tieBreak.topScorerHit
    || b.tieBreak.finalTeamHits - a.tieBreak.finalTeamHits
    || b.tieBreak.semifinalTeamHits - a.tieBreak.semifinalTeamHits
    || b.tieBreak.quarterfinalTeamHits - a.tieBreak.quarterfinalTeamHits
    || b.tieBreak.roundOf16TeamHits - a.tieBreak.roundOf16TeamHits
    || b.tieBreak.roundOf32TeamHits - a.tieBreak.roundOf32TeamHits
    || b.tieBreak.groupOutcomeHits - a.tieBreak.groupOutcomeHits;
}

function compareLeaderboardRowsWithProvisionalTieBreak(a, b) {
  return compareLeaderboardRows(a, b)
    || a.displayName.localeCompare(b.displayName);
}

function getPreviousMatchdayRank(trajectory) {
  const lastEntry = trajectory.at(-1);
  if (!lastEntry) {
    return null;
  }

  return trajectory
    .slice()
    .reverse()
    .find((entry) => entry.date !== lastEntry.date)?.rank ?? null;
}

export function getLeaderboard() {
  const users = db.prepare("SELECT id, email, display_name FROM users WHERE role = 'player' AND status = 'approved' ORDER BY display_name").all();
  const teams = db.prepare("SELECT * FROM teams").all();
  const matches = db.prepare("SELECT * FROM matches ORDER BY kickoff_at").all();
  const completedMatches = matches.filter((match) => match.actual_home_score !== null && match.actual_away_score !== null);
  const predictions = db.prepare("SELECT * FROM predictions").all();
  const qualifiers = db.prepare("SELECT * FROM user_qualifier_predictions").all();
  const groupOrders = db.prepare("SELECT * FROM user_group_order_predictions").all();
  const officialGroupOrders = db.prepare("SELECT group_name, team_order FROM official_group_order").all();
  const actualQualifiers = db.prepare("SELECT * FROM stage_qualifiers").all();
  const bonusAnswers = db.prepare("SELECT * FROM bonus_answers").all();
  const bonusResults = db.prepare("SELECT * FROM bonus_results").all();

  const predictionsByUser = Object.groupBy(predictions, ({ user_id }) => user_id);
  const qualifiersByUser = Object.groupBy(qualifiers, ({ user_id }) => user_id);
  const groupOrdersByUser = Object.groupBy(groupOrders, ({ user_id }) => user_id);
  const bonusByUser = Object.groupBy(bonusAnswers, ({ user_id }) => user_id);
  const actualGroupRankMap = buildActualGroupRankMap([], matches, officialGroupOrders);
  const bonusResultsMap = Object.fromEntries(bonusResults.map((item) => [item.question_key, item.correct_value]));
  const rankingHistoryByUser = buildRankingHistory(users, completedMatches, predictionsByUser);

  const leaderboard = users.map((user) => {
    const userPredictions = predictionsByUser[user.id] ?? [];
    const userQualifiers = qualifiersByUser[user.id] ?? [];
    const userGroupOrders = groupOrdersByUser[user.id] ?? [];
    const userBonus = bonusByUser[user.id] ?? [];

    let exactHits = 0;
    let outcomeHits = 0;
    let matchPoints = 0;

    for (const prediction of userPredictions) {
      const match = matches.find((item) => item.id === prediction.match_id);
      if (!match) {
        continue;
      }

      const result = scorePrediction(prediction, match);
      matchPoints += result.points;
      if (result.points === 5) exactHits += 1;
      if (result.points === 2) outcomeHits += 1;
    }

    const groupPerfectBonus = scoreGroupPerfectBonuses(matches, userPredictions);
    const groupPerfectPoints = groupPerfectBonus.points;

    let bonusPoints = 0;
    let topScorerHit = 0;
    for (const answer of userBonus) {
      const question = tournamentConfig.bonusQuestions.find((item) => item.key === answer.question_key);
      if (question && normalizeAnswer(bonusResultsMap[answer.question_key]) === normalizeAnswer(answer.answer_value)) {
        bonusPoints += question.points;
        if (answer.question_key === "topScorer") {
          topScorerHit = 1;
        }
      }
    }

    const bracketProgress = scoreBracketProgression({
      matches,
      teams,
      userPredictions,
      userQualifiers,
      userGroupOrders,
      actualQualifiers,
      officialGroupOrders
    });
    const bracketPoints = bracketProgress.points;
    const totalPoints = matchPoints + groupPerfectPoints + bonusPoints + bracketPoints;
    const identity = getPlayerIdentity(user);

    return {
      userId: user.id,
      displayName: user.display_name,
      email: user.email,
      initials: identity.initials,
      color: identity.color,
      totalPoints,
      exactHits,
      outcomeHits,
      qualifierPoints: groupPerfectPoints,
      groupPerfectPoints,
      groupPerfectDetails: groupPerfectBonus.details,
      bonusPoints,
      bracketPoints,
      bracketDetails: bracketProgress.details,
      tieBreak: {
        championHit: bracketProgress.tieBreak.championHit,
        topScorerHit,
        finalTeamHits: bracketProgress.tieBreak.finalTeamHits,
        semifinalTeamHits: bracketProgress.tieBreak.semifinalTeamHits,
        quarterfinalTeamHits: bracketProgress.tieBreak.quarterfinalTeamHits,
        roundOf16TeamHits: bracketProgress.tieBreak.roundOf16TeamHits,
        roundOf32TeamHits: bracketProgress.tieBreak.roundOf32TeamHits,
        groupOutcomeHits: outcomeHits
      },
      trajectory: rankingHistoryByUser.get(user.id) ?? []
    };
  });

  return leaderboard.sort(compareLeaderboardRowsWithProvisionalTieBreak)
    .map((entry, index, rows) => {
      const previousRank = getPreviousMatchdayRank(entry.trajectory);
      const rank = index + 1;
      return {
        ...entry,
        rank,
        prizeShared: (index > 0 && compareLeaderboardRows(entry, rows[index - 1]) === 0)
          || (rows[index + 1] ? compareLeaderboardRows(entry, rows[index + 1]) === 0 : false),
        previousRank,
        rankDelta: previousRank ? previousRank - rank : 0,
        leadGap: index === 0 ? 0 : rows[0].totalPoints - entry.totalPoints
      };
    });
}

export function getDashboardForUser(userId) {
  const leaderboard = getLeaderboard();
  const me = leaderboard.find((item) => item.userId === userId);
  const upcomingMatches = db.prepare(`
    SELECT *
    FROM matches
    WHERE datetime(kickoff_at) >= datetime('now')
    ORDER BY kickoff_at
    LIMIT 6
  `).all().map((match) => ({
    ...match,
    stageLabel: STAGE_LABELS[match.stage] ?? match.stage
  }));

  const filledPredictions = db.prepare("SELECT COUNT(*) AS count FROM predictions WHERE user_id = ?").get(userId).count;
  const totalMatches = db.prepare("SELECT COUNT(*) AS count FROM matches").get().count;
  const pendingPredictions = totalMatches - filledPredictions;
  const resolvedPredictions = db.prepare(`
    SELECT COUNT(*) AS count
    FROM predictions p
    JOIN matches m ON m.id = p.match_id
    WHERE p.user_id = ?
      AND m.actual_home_score IS NOT NULL
      AND m.actual_away_score IS NOT NULL
  `).get(userId).count;
  const qualifierPredictions = db.prepare("SELECT COUNT(*) AS count FROM user_qualifier_predictions WHERE user_id = ?").get(userId).count;
  const bonusAnswers = db.prepare("SELECT COUNT(*) AS count FROM bonus_answers WHERE user_id = ?").get(userId).count;
  const totalChecklist = totalMatches + tournamentConfig.bonusQuestions.length;
  const completedChecklist = filledPredictions + bonusAnswers;

  return {
    me,
    leaderboard,
    upcomingMatches,
    recentResults: buildRecentResults(userId),
    stats: {
      filledPredictions,
      pendingPredictions,
      users: leaderboard.length,
      resolvedPredictions,
      completionPct: totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0
    }
  };
}
