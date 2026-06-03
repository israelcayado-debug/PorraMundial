import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Trophy, Mail, Shield, Target, Lock, Flame, CheckCircle2, Radar, TrendingUp } from "lucide-react";
import { LeaderboardTable } from "../components/LeaderboardTable.jsx";
import { FlagBadge, MatchCard } from "../components/MatchCard.jsx";
import { HelpPanel } from "../components/HelpPanel.jsx";
import { ScorerInput } from "../components/ScorerInput.jsx";
import { StatCard } from "../components/StatCard.jsx";
import { appAsset } from "../lib.js";

const knockoutTabs = [
  { key: "round_of_32", label: "Dieciseisavos" },
  { key: "round_of_16", label: "Octavos" },
  { key: "quarterfinals", label: "Cuartos" },
  { key: "semifinals", label: "Semifinales" },
  { key: "third_place", label: "3º puesto" },
  { key: "final", label: "Final" }
];

const playTabs = [
  { key: "groups", label: "Grupos" },
  { key: "knockout", label: "Eliminatorias" },
  { key: "scorer", label: "Goleador" }
];

function resolvePredictionWinner(prediction, homeCode, awayCode) {
  if (!prediction) {
    return null;
  }

  if (prediction.predicted_home_score > prediction.predicted_away_score) {
    return homeCode;
  }

  if (prediction.predicted_away_score > prediction.predicted_home_score) {
    return awayCode;
  }

  return null;
}

function resolvePredictionLoser(prediction, homeCode, awayCode) {
  if (!prediction) {
    return null;
  }

  if (prediction.predicted_home_score < prediction.predicted_away_score) {
    return homeCode;
  }

  if (prediction.predicted_away_score < prediction.predicted_home_score) {
    return awayCode;
  }

  return null;
}

function StageTabs({ tabs, activeTab, onChange }) {
  return (
    <div className="stage-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={activeTab === tab.key ? "active" : ""}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function getPredictionOutcome(prediction) {
  if (!prediction) {
    return null;
  }

  if (prediction.predicted_home_score === prediction.predicted_away_score) {
    return "draw";
  }

  return prediction.predicted_home_score > prediction.predicted_away_score ? "home" : "away";
}

function buildThirdPlaceAssignments(matches, rankData) {
  const usedTeams = new Set();
  const assignments = {};

  for (const match of matches.filter((item) => item.stage === "round_of_32").sort((a, b) => (a.match_number || a.id) - (b.match_number || b.id))) {
    for (const side of ["home_team", "away_team"]) {
      if (match[side] !== "3") {
        continue;
      }

      const eligibleGroups = (match.group_name || "").split("");
      const assigned = (rankData.__thirdRanking || [])
        .find((entry) => eligibleGroups.includes(entry.groupName) && !usedTeams.has(entry.teamCode));
      if (assigned?.teamCode) {
        assignments[`${match.id}:${side}`] = assigned.teamCode;
        usedTeams.add(assigned.teamCode);
      }
    }
  }

  return assignments;
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

function buildPredictedGroupRanks(matches, predictionsByMatch, groupOrdersByGroup = {}) {
  const groupTeams = new Map();
  const groupMatchCounts = new Map();
  const groupPredictedCounts = new Map();
  const standings = new Map();

  for (const match of matches.filter((item) => item.stage === "groups" && item.group_name)) {
    groupTeams.set(match.group_name, [...new Set([...(groupTeams.get(match.group_name) ?? []), match.home_team, match.away_team])]);
    groupMatchCounts.set(match.group_name, (groupMatchCounts.get(match.group_name) ?? 0) + 1);

    if (!standings.has(match.group_name)) {
      standings.set(match.group_name, new Map());
    }

    const groupStanding = standings.get(match.group_name);
    groupStanding.set(match.home_team, groupStanding.get(match.home_team) ?? 0);
    groupStanding.set(match.away_team, groupStanding.get(match.away_team) ?? 0);

    const outcome = getPredictionOutcome(predictionsByMatch[match.id]);
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

  const ranks = {};
  const thirdRanking = [];

  for (const [groupName, groupStanding] of standings.entries()) {
    if ((groupPredictedCounts.get(groupName) ?? 0) < (groupMatchCounts.get(groupName) ?? 0)) {
      continue;
    }

    const originalOrder = groupTeams.get(groupName) ?? [];
    const manualOrder = groupOrdersByGroup[groupName] ?? [];
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

    ranks[`1${groupName}`] = sortedTeams[0]?.teamCode;
    ranks[`2${groupName}`] = sortedTeams[1]?.teamCode;
    ranks[`3${groupName}`] = sortedTeams[2]?.teamCode;

    if (sortedTeams[2]?.teamCode) {
      thirdRanking.push({
        groupName,
        teamCode: sortedTeams[2].teamCode,
        points: sortedTeams[2].points
      });
    }
  }

  ranks.__thirdRanking = thirdRanking.sort((a, b) => b.points - a.points || a.groupName.localeCompare(b.groupName));
  return ranks;
}

function GroupPredictionBoard({ groupName, matches, predictionsByMatch, teamsByCode, groupOrder, onSavePrediction, onSaveGroupOrder, disabled }) {
  const teamOrder = useMemo(() => [...new Set(matches.flatMap((match) => [match.home_team, match.away_team]))], [matches]);
  const manualOrder = groupOrder?.length === teamOrder.length ? groupOrder : teamOrder;

  const projectedStandings = useMemo(() => {
    const rows = teamOrder.map((teamCode) => ({
      teamCode,
      points: 0,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0
    }));
    const rowsByTeam = Object.fromEntries(rows.map((row) => [row.teamCode, row]));

    for (const match of matches) {
      const outcome = getPredictionOutcome(predictionsByMatch[match.id]);
      if (!outcome) {
        continue;
      }

      rowsByTeam[match.home_team].played += 1;
      rowsByTeam[match.away_team].played += 1;

      if (outcome === "home") {
        rowsByTeam[match.home_team].points += 3;
        rowsByTeam[match.home_team].wins += 1;
        rowsByTeam[match.away_team].losses += 1;
      } else if (outcome === "away") {
        rowsByTeam[match.away_team].points += 3;
        rowsByTeam[match.away_team].wins += 1;
        rowsByTeam[match.home_team].losses += 1;
      } else {
        rowsByTeam[match.home_team].points += 1;
        rowsByTeam[match.away_team].points += 1;
        rowsByTeam[match.home_team].draws += 1;
        rowsByTeam[match.away_team].draws += 1;
      }
    }

    return rows.sort((a, b) => {
      const pointsDiff = b.points - a.points;
      if (pointsDiff !== 0) {
        return pointsDiff;
      }

      return manualOrder.indexOf(a.teamCode) - manualOrder.indexOf(b.teamCode)
        || teamOrder.indexOf(a.teamCode) - teamOrder.indexOf(b.teamCode);
    });
  }, [matches, manualOrder, predictionsByMatch, teamOrder]);

  const saveOutcome = (matchId, outcome) => {
    if (outcome === "home") {
      onSavePrediction(matchId, 1, 0);
      return;
    }

    if (outcome === "away") {
      onSavePrediction(matchId, 0, 1);
      return;
    }

    onSavePrediction(matchId, 0, 0);
  };

  const moveTieBreaker = (teamCode, direction) => {
    const currentOrder = projectedStandings.map((row) => row.teamCode);
    const currentIndex = currentOrder.indexOf(teamCode);
    const targetIndex = currentIndex + direction;

    if (targetIndex < 0 || targetIndex >= currentOrder.length) {
      return;
    }

    const nextOrder = [...currentOrder];
    [nextOrder[currentIndex], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[currentIndex]];
    onSaveGroupOrder(groupName, nextOrder);
  };

  return (
    <div className="group-sheet">
      <div className="group-sheet__header">
        <strong>Grupo {groupName}</strong>
        <span>Resultado 1 / X / 2</span>
      </div>
      <div className="group-sheet__rows">
        {matches.map((match) => {
          const home = teamsByCode[match.home_team];
          const away = teamsByCode[match.away_team];
          const selected = getPredictionOutcome(predictionsByMatch[match.id]);

          return (
            <div key={`group-row-${match.id}`} className="group-sheet__row">
              <span className="group-sheet__date">{dayjs(match.kickoff_at).format("DD MMM · HH:mm")}</span>
              <div className="group-sheet__match">
                <span>
                  <FlagBadge code={match.home_team} label={home?.name || match.home_team} />
                  {home?.name || match.home_team}
                </span>
                <strong>vs</strong>
                <span>
                  <FlagBadge code={match.away_team} label={away?.name || match.away_team} />
                  {away?.name || match.away_team}
                </span>
              </div>
              <div className="group-sheet__outcomes">
                <button
                  type="button"
                  className={selected === "home" ? "active" : ""}
                  onClick={() => saveOutcome(match.id, "home")}
                  disabled={disabled}
                  title={`Gana ${home?.name || match.home_team}`}
                >
                  1
                </button>
                <button
                  type="button"
                  className={selected === "draw" ? "active" : ""}
                  onClick={() => saveOutcome(match.id, "draw")}
                  disabled={disabled}
                  title="Empate"
                >
                  X
                </button>
                <button
                  type="button"
                  className={selected === "away" ? "active" : ""}
                  onClick={() => saveOutcome(match.id, "away")}
                  disabled={disabled}
                  title={`Gana ${away?.name || match.away_team}`}
                >
                  2
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="group-standings">
        <div className="group-standings__header">
          <strong>Clasificación prevista</strong>
          <span>PTS</span>
          <span>PJ</span>
          <span>G</span>
          <span>E</span>
          <span>P</span>
          <span>Desempate</span>
        </div>
        {projectedStandings.map((row, index) => {
          const team = teamsByCode[row.teamCode];
          const canMoveUp = index > 0 && projectedStandings[index - 1].points === row.points;
          const canMoveDown = index < projectedStandings.length - 1 && projectedStandings[index + 1].points === row.points;
          return (
            <div key={`standing-${groupName}-${row.teamCode}`} className={index < 2 ? "group-standings__row qualifies" : "group-standings__row"}>
              <span className="group-standings__team">
                <strong>{index + 1}</strong>
                <FlagBadge code={row.teamCode} label={team?.name || row.teamCode} />
                {team?.name || row.teamCode}
              </span>
              <strong>{row.points}</strong>
              <span>{row.played}</span>
              <span>{row.wins}</span>
              <span>{row.draws}</span>
              <span>{row.losses}</span>
              <span className="group-standings__tie">
                <button
                  type="button"
                  onClick={() => moveTieBreaker(row.teamCode, -1)}
                  disabled={disabled || !canMoveUp}
                  title="Subir en el desempate"
                >
                  Subir
                </button>
                <button
                  type="button"
                  onClick={() => moveTieBreaker(row.teamCode, 1)}
                  disabled={disabled || !canMoveDown}
                  title="Bajar en el desempate"
                >
                  Bajar
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getPendingSource(token) {
  const winnerToken = /^W(\d+)$/.exec(token || "");
  if (winnerToken) {
    return `partido ${winnerToken[1]}`;
  }

  const rankToken = /^([123])([A-L])$/.exec(token || "");
  if (rankToken) {
    return rankToken[1] === "3" ? `mejor tercero del grupo ${rankToken[2]}` : `grupo ${rankToken[2]}`;
  }

  if (token === "3") {
    return "mejores terceros";
  }

  return null;
}

export function PlayerPage({
  data,
  tournament,
  onSavePrediction,
  onSaveQualifier,
  onSaveGroupOrder,
  onSaveBonus,
  onLogout
}) {
  const { user, dashboard, predictions, qualifiers, groupOrders = [], bonusAnswers } = data;
  const teamsByCode = Object.fromEntries(tournament.teams.map((team) => [team.code, team]));
  const predictionsByMatch = Object.fromEntries(predictions.map((row) => [row.match_id, row]));
  const qualifiersByGroup = Object.fromEntries(qualifiers.map((row) => [row.group_name, row]));
  const groupOrdersByGroup = Object.fromEntries(groupOrders.map((row) => [row.group_name, parseTeamOrder(row.team_order)]));
  const bonusByKey = Object.fromEntries(bonusAnswers.map((row) => [row.question_key, row.answer_value]));
  const matchesByNumber = Object.fromEntries(tournament.matches.filter((match) => match.match_number).map((match) => [match.match_number, match]));
  const predictedGroupRanks = useMemo(
    () => buildPredictedGroupRanks(tournament.matches, predictionsByMatch, groupOrdersByGroup),
    [tournament.matches, predictionsByMatch, groupOrdersByGroup]
  );
  const predictedThirdAssignments = useMemo(
    () => buildThirdPlaceAssignments(tournament.matches, predictedGroupRanks),
    [tournament.matches, predictedGroupRanks]
  );

  const groupTabs = useMemo(() => {
    const groups = [...new Set(tournament.matches.filter((match) => match.stage === "groups" && match.group_name).map((match) => match.group_name))];
    return groups.sort().map((group) => ({ key: group, label: `Grupo ${group}` }));
  }, [tournament.matches]);

  const [activeGroupTab, setActiveGroupTab] = useState(groupTabs[0]?.key || "A");
  const [activeKnockoutTab, setActiveKnockoutTab] = useState("round_of_16");
  const [activePlayTab, setActivePlayTab] = useState("groups");
  const [showHelp, setShowHelp] = useState(false);
  const [bonusSaveStatus, setBonusSaveStatus] = useState({});

  useEffect(() => {
    if (groupTabs.length > 0 && !groupTabs.some((tab) => tab.key === activeGroupTab)) {
      setActiveGroupTab(groupTabs[0].key);
    }
  }, [groupTabs, activeGroupTab]);

  const groupMatches = tournament.matches.filter((match) => match.stage === "groups" && match.group_name === activeGroupTab);
  const resolveTokenToCode = useMemo(() => {
    const cache = new Map();

    const resolve = (token, contextMatch) => {
      if (!token) {
        return null;
      }

      const cacheKey = `${contextMatch?.match_number || contextMatch?.id || "x"}:${token}`;
      if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
      }

      if (teamsByCode[token]) {
        cache.set(cacheKey, token);
        return token;
      }

      const groupRankToken = /^([12])([A-L])$/.exec(token);
      if (groupRankToken) {
        const resolved = predictedGroupRanks[token];
        cache.set(cacheKey, resolved || null);
        return resolved || null;
      }

      if (token === "3") {
        const side = contextMatch?.home_team === "3" ? "home_team" : contextMatch?.away_team === "3" ? "away_team" : null;
        const resolved = side ? predictedThirdAssignments[`${contextMatch.id}:${side}`] : null;
        cache.set(cacheKey, resolved || null);
        return resolved || null;
      }

      const winnerToken = /^W(\d+)$/.exec(token);
      if (winnerToken) {
        const previousMatch = matchesByNumber[Number(winnerToken[1])];
        if (!previousMatch) {
          cache.set(cacheKey, null);
          return null;
        }

        const resolvedHome = resolve(previousMatch.home_team, previousMatch);
        const resolvedAway = resolve(previousMatch.away_team, previousMatch);
        const resolved = resolvePredictionWinner(predictionsByMatch[previousMatch.id], resolvedHome, resolvedAway);
        cache.set(cacheKey, resolved || null);
        return resolved || null;
      }

      const loserToken = /^L(\d+)$/.exec(token);
      if (loserToken) {
        const previousMatch = matchesByNumber[Number(loserToken[1])];
        if (!previousMatch) {
          cache.set(cacheKey, null);
          return null;
        }

        const resolvedHome = resolve(previousMatch.home_team, previousMatch);
        const resolvedAway = resolve(previousMatch.away_team, previousMatch);
        const resolved = resolvePredictionLoser(predictionsByMatch[previousMatch.id], resolvedHome, resolvedAway);
        cache.set(cacheKey, resolved || null);
        return resolved || null;
      }

      cache.set(cacheKey, null);
      return null;
    };

    return resolve;
  }, [matchesByNumber, predictionsByMatch, predictedGroupRanks, predictedThirdAssignments, teamsByCode]);

  const knockoutMatches = tournament.matches
    .filter((match) => match.stage === activeKnockoutTab)
    .map((match) => {
      const resolvedHome = resolveTokenToCode(match.home_team, match);
      const resolvedAway = resolveTokenToCode(match.away_team, match);
      const pendingSources = [
        resolvedHome ? null : getPendingSource(match.home_team),
        resolvedAway ? null : getPendingSource(match.away_team)
      ].filter(Boolean);

      return {
        ...match,
        hasUnresolvedParticipants: pendingSources.length > 0,
        pendingReason: pendingSources.length > 0 ? `Completa antes ${pendingSources.join(" y ")}` : null,
        participantLabels: {
          ...(resolvedHome && teamsByCode[resolvedHome]
            ? {
                [match.home_team]: {
                  code: resolvedHome,
                  flag: teamsByCode[resolvedHome].flag,
                  name: teamsByCode[resolvedHome].name
                }
              }
            : {}),
          ...(resolvedAway && teamsByCode[resolvedAway]
            ? {
                [match.away_team]: {
                  code: resolvedAway,
                  flag: teamsByCode[resolvedAway].flag,
                  name: teamsByCode[resolvedAway].name
                }
              }
            : {})
        }
      };
    });

  const betsLocked = Boolean(tournament.settings?.betsLocked);
  const closesAtLabel = tournament.settings?.bettingClosesAt
    ? dayjs(tournament.settings.bettingClosesAt).format("DD/MM/YYYY HH:mm")
    : "sin definir";
  const upcomingHeroMatches = dashboard.upcomingMatches.slice(0, 3);
  const recentResults = dashboard.recentResults ?? [];
  const rankHistory = dashboard.me?.trajectory ?? [];
  const bracketDetails = dashboard.me?.bracketDetails ?? [];

  return (
    <div className="dashboard">
      <header className="topbar">
        <div>
          <img className="brand-logo brand-logo--topbar" src={appAsset("delfin-logo.png")} alt="Delfin Tubes" />
          <span className="hero-tag">DelfinPorra 2026</span>
          <h1>Hola, {user.displayName}</h1>
          <p>Tu zona de apuestas está separada de la administración y organizada por grupos y fases eliminatorias.</p>
        </div>
        <div className="topbar__actions">
          <button className="ghost-button" onClick={() => setShowHelp((value) => !value)}>
            {showHelp ? "Ocultar ayuda" : "Ayuda"}
          </button>
          <button className="ghost-button" onClick={onLogout}>Salir</button>
        </div>
      </header>

      {showHelp && <HelpPanel audience="player" onClose={() => setShowHelp(false)} />}

      <section className="hero-panel">
        <div className="hero-panel__content">
          <div className="hero-panel__headline">
            <span className="player-avatar player-avatar--large" style={{ "--player-color": dashboard.me?.color }}>{dashboard.me?.initials || "?"}</span>
            <div>
              <h2>{dashboard.me?.rank ?? "-"}º puesto</h2>
              <p>{user.displayName} · {dashboard.me?.totalPoints ?? 0} puntos totales</p>
            </div>
          </div>
          <div className="stats-grid">
            <StatCard label="Pronósticos hechos" value={dashboard.stats.filledPredictions} />
            <StatCard label="Pendientes" value={dashboard.stats.pendingPredictions} accent="gold" />
            <StatCard label="Jugadores" value={dashboard.stats.users} accent="green" />
            <StatCard label="Aciertos 1/X/2" value={dashboard.me?.outcomeHits ?? 0} accent="pink" />
          </div>
          <div className="hero-mini-strip">
            <div className="mini-progress-card">
              <CheckCircle2 size={18} />
              <div>
                <strong>{dashboard.stats.completionPct}% completado</strong>
                <span>Porra rellenada entre partidos y máximo goleador</span>
              </div>
            </div>
            <div className="mini-progress-card">
              <Radar size={18} />
              <div>
                <strong>{dashboard.stats.resolvedPredictions} apuestas evaluadas</strong>
                <span>Ya tienen resultado oficial y puntúan en la clasificación</span>
              </div>
            </div>
          </div>
          <div className={`lock-banner ${betsLocked ? "is-locked" : ""}`}>
            <Lock size={18} />
            <span>
              {betsLocked
                ? `Apuestas cerradas desde ${closesAtLabel}`
                : `Las apuestas se bloquearán el ${closesAtLabel}`}
            </span>
          </div>
        </div>
        <div className="hero-panel__chart">
          <div className="chart-title">
            <Shield size={18} />
            <span>Tu trayectoria</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dashboard.me?.trajectory ?? []}>
              <XAxis dataKey="date" stroke="#dce8ff" />
              <YAxis stroke="#dce8ff" allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="#ffd166" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
          <div className="upcoming-hero-list">
            {upcomingHeroMatches.map((match) => (
              <div key={`hero-upcoming-${match.id}`} className="upcoming-hero-item">
                <span>{teamsByCode[match.home_team]?.flag} {teamsByCode[match.home_team]?.name}</span>
                <strong>{dayjs(match.kickoff_at).format("DD MMM · HH:mm")}</strong>
                <span>{teamsByCode[match.away_team]?.flag} {teamsByCode[match.away_team]?.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="content-grid">
        <div className="panel">
          <div className="panel__title">
            <Trophy size={18} />
            <h3>Clasificación general</h3>
          </div>
          <LeaderboardTable rows={dashboard.leaderboard} currentUserId={user.id} />
        </div>

        <div className="panel">
          <div className="panel__title">
            <Flame size={18} />
            <h3>Seguimiento de resultados</h3>
          </div>
          {recentResults.length > 0 ? (
            <div className="results-feed">
              {recentResults.map((item) => (
                <article key={`result-${item.matchId}`} className={`result-card result-card--${item.points > 0 ? "hit" : "miss"}`}>
                  <div className="result-card__head">
                    <span className="pill">{item.stageLabel}</span>
                    <strong>{item.points} pts</strong>
                  </div>
                  <h4>
                    {teamsByCode[item.homeTeam]?.flag || ""} {teamsByCode[item.homeTeam]?.name || item.homeTeam} vs {teamsByCode[item.awayTeam]?.flag || ""} {teamsByCode[item.awayTeam]?.name || item.awayTeam}
                  </h4>
                  <p>
                    Tu apuesta: {item.predictedOutcome} · Resultado oficial: {item.actualOutcome}
                  </p>
                  <span>{item.reason}</span>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">Cuando empiecen a cerrarse partidos verás aquí qué apuestas te están dando puntos y por qué.</div>
          )}
        </div>

        <div className="panel">
          <div className="panel__title">
            <TrendingUp size={18} />
            <h3>Evolucion por partido</h3>
          </div>
          {rankHistory.length > 0 ? (
            <div className="rank-history">
              {rankHistory.slice().reverse().map((item) => (
                <article key={`history-${item.matchNumber}-${item.date}`} className="rank-history__item">
                  <span>
                    {teamsByCode[item.homeTeam]?.name || item.homeTeam} vs {teamsByCode[item.awayTeam]?.name || item.awayTeam}
                    <small>Partido {item.matchNumber}</small>
                  </span>
                  <strong>#{item.rank}</strong>
                  <span>+{item.matchPoints} pts · {item.total} total · {item.date}</span>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">El historial aparecerá cuando haya partidos con resultado oficial y apuestas puntuadas.</div>
          )}
        </div>

        <div className="panel">
          <div className="panel__title">
            <Target size={18} />
            <h3>Puntos por cuadro</h3>
          </div>
          <div className="bracket-score-grid">
            {bracketDetails.map((stage) => (
              <article key={`bracket-score-${stage.stage}`} className="bracket-score-card">
                <div>
                  <strong>{stage.label}</strong>
                  <span>{stage.points} pts</span>
                </div>
                <p>
                  {stage.elsewherePoints > 0
                    ? `${stage.exactHits} en su sitio · ${stage.elsewhereHits} fuera de sitio`
                    : `${stage.exactHits} aciertos`}
                </p>
                <small>
                  {stage.elsewherePoints > 0
                    ? `${stage.exactPoints} pts en sitio · ${stage.elsewherePoints} pts fuera`
                    : `${stage.exactPoints} pts por acierto`}
                </small>
              </article>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel__title">
            <Mail size={18} />
            <h3>Correo diario</h3>
          </div>
          <p className="muted">
            El sistema enviará resúmenes diarios de clasificación durante el Mundial. Tu parte aquí es dejar tus apuestas bien cerradas antes del bloqueo.
          </p>
          <div className="mail-preview">
            <span>Resumen de posición</span>
            <span>Evolución de puntos</span>
            <span>Top 10 del día</span>
          </div>
        </div>
      </section>

      <section className="panel play-panel">
        <div className="panel__title">
          <Target size={18} />
          <h3>Tu porra</h3>
        </div>
        <StageTabs tabs={playTabs} activeTab={activePlayTab} onChange={setActivePlayTab} />

        {activePlayTab === "groups" && (
          <>
            <StageTabs tabs={groupTabs} activeTab={activeGroupTab} onChange={setActiveGroupTab} />
            <GroupPredictionBoard
              groupName={activeGroupTab}
              matches={groupMatches}
              predictionsByMatch={predictionsByMatch}
              teamsByCode={teamsByCode}
              groupOrder={groupOrdersByGroup[activeGroupTab]}
              onSavePrediction={onSavePrediction}
              onSaveGroupOrder={onSaveGroupOrder}
              disabled={betsLocked}
            />
          </>
        )}

        {activePlayTab === "knockout" && (
          <>
            <StageTabs tabs={knockoutTabs} activeTab={activeKnockoutTab} onChange={setActiveKnockoutTab} />
            <div className="matches-grid">
              {knockoutMatches.length > 0 ? (
                knockoutMatches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    prediction={predictionsByMatch[match.id]}
                    onSave={onSavePrediction}
                    teamsByCode={teamsByCode}
                    disabled={betsLocked || match.hasUnresolvedParticipants}
                    buttonLabel={betsLocked ? "Cerrado" : "Guardar"}
                  />
                ))
              ) : (
                <div className="empty-state">Todavía no hay partidos cargados para esta fase.</div>
              )}
            </div>
          </>
        )}

        {activePlayTab === "scorer" && (
          <div className="scorer-panel">
            <div className="panel__title">
              <Trophy size={18} />
              <h3>Máximo goleador</h3>
            </div>
            <div className="bonus-grid">
              {tournament.bonusQuestions.map((question) => (
                <form
                  key={question.key}
                  className="bonus-card"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    setBonusSaveStatus((current) => ({ ...current, [question.key]: "Guardando..." }));
                    try {
                      await onSaveBonus(question.key, form.get("answer"));
                      setBonusSaveStatus((current) => ({ ...current, [question.key]: "Goleador guardado" }));
                    } catch (err) {
                      setBonusSaveStatus((current) => ({
                        ...current,
                        [question.key]: err.message || "No se pudo guardar el goleador"
                      }));
                    }
                  }}
                >
                  <span className="pill">{question.points} pts</span>
                  <h4>{question.label}</h4>
                  <ScorerInput
                    value={bonusByKey[question.key] || ""}
                    disabled={betsLocked}
                  />
                  <button type="submit" disabled={betsLocked}>{betsLocked ? "Cerrado" : "Guardar goleador"}</button>
                  {bonusSaveStatus[question.key] && (
                    <small className="scorer-input__status">{bonusSaveStatus[question.key]}</small>
                  )}
                </form>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}


