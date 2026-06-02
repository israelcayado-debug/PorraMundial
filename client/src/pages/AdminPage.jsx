import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Mail, Settings, Users, SendHorizontal, CalendarRange, Pencil, Trash2, Plus, Trophy, Shield, Target, Download, ClipboardList } from "lucide-react";
import { HelpPanel } from "../components/HelpPanel.jsx";
import { MatchCard } from "../components/MatchCard.jsx";
import { ScorerInput } from "../components/ScorerInput.jsx";

const stageOptions = [
  { value: "groups", label: "Fase de grupos" },
  { value: "round_of_32", label: "Dieciseisavos" },
  { value: "round_of_16", label: "Octavos" },
  { value: "quarterfinals", label: "Cuartos" },
  { value: "semifinals", label: "Semifinales" },
  { value: "third_place", label: "Tercer puesto" },
  { value: "final", label: "Final" }
];

function toDateTimeLocal(value) {
  if (!value) return "";
  return dayjs(value).format("YYYY-MM-DDTHH:mm");
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

function buildGroupStandings(matches, teamsByCode, groupOrder = []) {
  const teamOrder = [...new Set(matches.flatMap((match) => [match.home_team, match.away_team]))];
  const manualOrder = groupOrder.length === teamOrder.length ? groupOrder : teamOrder;
  const rows = teamOrder.map((teamCode) => ({
    teamCode,
    points: 0,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    name: teamsByCode[teamCode]?.name || teamCode
  }));
  const rowsByTeam = Object.fromEntries(rows.map((row) => [row.teamCode, row]));
  let completed = 0;

  for (const match of matches) {
    if (match.actual_home_score === null || match.actual_away_score === null) {
      continue;
    }

    completed += 1;
    rowsByTeam[match.home_team].played += 1;
    rowsByTeam[match.away_team].played += 1;

    if (match.actual_home_score > match.actual_away_score) {
      rowsByTeam[match.home_team].points += 3;
      rowsByTeam[match.home_team].wins += 1;
      rowsByTeam[match.away_team].losses += 1;
    } else if (match.actual_away_score > match.actual_home_score) {
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

  return {
    completed,
    total: matches.length,
    rows: rows.sort((a, b) => b.points - a.points || manualOrder.indexOf(a.teamCode) - manualOrder.indexOf(b.teamCode) || teamOrder.indexOf(a.teamCode) - teamOrder.indexOf(b.teamCode))
  };
}

function OfficialGroupStandings({ groupName, matches, teamsByCode, groupOrder, onSaveOfficialGroupOrder }) {
  const standings = useMemo(() => buildGroupStandings(matches, teamsByCode, groupOrder), [matches, teamsByCode, groupOrder]);

  const moveTieBreaker = (teamCode, direction) => {
    const currentOrder = standings.rows.map((row) => row.teamCode);
    const currentIndex = currentOrder.indexOf(teamCode);
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= currentOrder.length) {
      return;
    }

    const nextOrder = [...currentOrder];
    [nextOrder[currentIndex], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[currentIndex]];
    onSaveOfficialGroupOrder(groupName, nextOrder);
  };

  return (
    <div className="group-standings official-standings">
      <div className="group-standings__header">
        <strong>Clasificación real</strong>
        <span>PTS</span>
        <span>PJ</span>
        <span>G</span>
        <span>E</span>
        <span>P</span>
        <span>Desempate</span>
      </div>
      {standings.rows.map((row, index) => {
        const canMoveUp = index > 0 && standings.rows[index - 1].points === row.points;
        const canMoveDown = index < standings.rows.length - 1 && standings.rows[index + 1].points === row.points;
        return (
          <div key={`official-standing-${groupName}-${row.teamCode}`} className={index < 2 ? "group-standings__row qualifies" : "group-standings__row"}>
            <span className="group-standings__team">
              <strong>{index + 1}</strong>
              {row.name}
            </span>
            <strong>{row.points}</strong>
            <span>{row.played}</span>
            <span>{row.wins}</span>
            <span>{row.draws}</span>
            <span>{row.losses}</span>
            <span className="group-standings__tie">
              <button type="button" onClick={() => moveTieBreaker(row.teamCode, -1)} disabled={!canMoveUp}>Subir</button>
              <button type="button" onClick={() => moveTieBreaker(row.teamCode, 1)} disabled={!canMoveDown}>Bajar</button>
            </span>
          </div>
        );
      })}
      <p className="official-standings__note">
        {standings.completed < standings.total
          ? `Hay ${standings.completed}/${standings.total} resultados publicados. El desempate manual se aplicará cuando el grupo esté completo.`
          : "Si hay empate oficial por sorteo o criterio externo, usa Subir/Bajar para fijar el orden real."}
      </p>
    </div>
  );
}

function getActualWinner(match, homeCode, awayCode) {
  if (!match || match.actual_home_score === null || match.actual_away_score === null || match.actual_home_score === match.actual_away_score) {
    return null;
  }

  return match.actual_home_score > match.actual_away_score ? homeCode : awayCode;
}

function buildActualGroupRanks(matches, teamsByCode, officialGroupOrdersByGroup) {
  const ranks = {};
  const thirdRanking = [];
  const groupNames = [...new Set(matches.filter((match) => match.stage === "groups" && match.group_name).map((match) => match.group_name))];

  for (const groupName of groupNames) {
    const groupMatches = matches.filter((match) => match.stage === "groups" && match.group_name === groupName);
    const standings = buildGroupStandings(groupMatches, teamsByCode, officialGroupOrdersByGroup[groupName] || []);

    if (standings.completed < standings.total) {
      continue;
    }

    ranks[`1${groupName}`] = standings.rows[0]?.teamCode;
    ranks[`2${groupName}`] = standings.rows[1]?.teamCode;
    ranks[`3${groupName}`] = standings.rows[2]?.teamCode;

    if (standings.rows[2]?.teamCode) {
      thirdRanking.push({
        groupName,
        teamCode: standings.rows[2].teamCode,
        points: standings.rows[2].points
      });
    }
  }

  ranks.__thirdRanking = thirdRanking.sort((a, b) => b.points - a.points || a.groupName.localeCompare(b.groupName));
  return ranks;
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

function AdminCalendarEditor({ matches, teamsByCode, onCreate, onUpdate, onDelete }) {
  const [editingId, setEditingId] = useState(null);

  return (
    <div className="calendar-editor">
      <form
        className="calendar-form calendar-form--create"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          onCreate({
            stage: form.get("stage"),
            groupName: form.get("groupName"),
            kickoffAt: dayjs(form.get("kickoffAt")).toISOString(),
            homeTeam: form.get("homeTeam"),
            awayTeam: form.get("awayTeam")
          });
          event.currentTarget.reset();
        }}
      >
        <div className="panel__title">
          <Plus size={18} />
          <h3>Nuevo partido</h3>
        </div>
        <select name="stage" defaultValue="groups">
          {stageOptions.map((stage) => <option key={`new-${stage.value}`} value={stage.value}>{stage.label}</option>)}
        </select>
        <input name="groupName" defaultValue="A" placeholder="Grupo (A, B, C...)" />
        <input name="kickoffAt" type="datetime-local" defaultValue="2026-06-11T19:00" required />
        <select name="homeTeam" defaultValue="USA">
          {Object.values(teamsByCode).map((team) => <option key={`new-home-${team.code}`} value={team.code}>{team.flag} {team.name}</option>)}
        </select>
        <select name="awayTeam" defaultValue="MEX">
          {Object.values(teamsByCode).map((team) => <option key={`new-away-${team.code}`} value={team.code}>{team.flag} {team.name}</option>)}
        </select>
        <button type="submit">Añadir al calendario</button>
      </form>

      <div className="calendar-table-shell">
        <table className="leaderboard calendar-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Fase</th>
              <th>Grupo</th>
              <th>Local</th>
              <th>Visitante</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((match) => {
              const isEditing = editingId === match.id;
              return (
                <tr key={`calendar-${match.id}`}>
                  <td>
                    {isEditing ? (
                      <input form={`edit-match-${match.id}`} name="kickoffAt" type="datetime-local" defaultValue={toDateTimeLocal(match.kickoff_at)} required />
                    ) : (
                      dayjs(match.kickoff_at).format("DD/MM/YYYY HH:mm")
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <select form={`edit-match-${match.id}`} name="stage" defaultValue={match.stage}>
                        {stageOptions.map((stage) => <option key={`${match.id}-${stage.value}`} value={stage.value}>{stage.label}</option>)}
                      </select>
                    ) : (
                      stageOptions.find((stage) => stage.value === match.stage)?.label || match.stage
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input form={`edit-match-${match.id}`} name="groupName" defaultValue={match.group_name || ""} placeholder="Grupo" />
                    ) : (
                      match.stage === "groups" ? (match.group_name || "-") : "-"
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <select form={`edit-match-${match.id}`} name="homeTeam" defaultValue={match.home_team}>
                        {Object.values(teamsByCode).map((team) => <option key={`${match.id}-home-${team.code}`} value={team.code}>{team.flag} {team.name}</option>)}
                      </select>
                    ) : (
                      `${teamsByCode[match.home_team]?.flag || ""} ${teamsByCode[match.home_team]?.name || match.home_team}`
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <select form={`edit-match-${match.id}`} name="awayTeam" defaultValue={match.away_team}>
                        {Object.values(teamsByCode).map((team) => <option key={`${match.id}-away-${team.code}`} value={team.code}>{team.flag} {team.name}</option>)}
                      </select>
                    ) : (
                      `${teamsByCode[match.away_team]?.flag || ""} ${teamsByCode[match.away_team]?.name || match.away_team}`
                    )}
                  </td>
                  <td>
                    <div className="calendar-actions">
                      {isEditing ? (
                        <>
                          <form
                            id={`edit-match-${match.id}`}
                            onSubmit={(event) => {
                              event.preventDefault();
                              const form = new FormData(event.currentTarget);
                              onUpdate(match.id, {
                                stage: form.get("stage"),
                                groupName: form.get("groupName"),
                                kickoffAt: dayjs(form.get("kickoffAt")).toISOString(),
                                homeTeam: form.get("homeTeam"),
                                awayTeam: form.get("awayTeam")
                              });
                              setEditingId(null);
                            }}
                          />
                          <button className="calendar-action save" form={`edit-match-${match.id}`} type="submit">Guardar</button>
                          <button className="calendar-action cancel" type="button" onClick={() => setEditingId(null)}>Cancelar</button>
                        </>
                      ) : (
                        <>
                          <button className="calendar-action edit" type="button" onClick={() => setEditingId(match.id)}>
                            <Pencil size={14} />
                            <span>Editar</span>
                          </button>
                          <button className="calendar-action delete" type="button" onClick={() => onDelete(match.id)}>
                            <Trash2 size={14} />
                            <span>Borrar</span>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminUsersManager({ users, currentUserId, onCreateUser, onUpdateUser, onUpdateUserStatus, onResetUserPassword, onDeleteUser }) {
  const [editingId, setEditingId] = useState(null);
  const [resettingId, setResettingId] = useState(null);

  return (
    <div className="user-manager">
      <form
        className="calendar-form user-create-form"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          onCreateUser({
            displayName: form.get("displayName"),
            email: form.get("email"),
            password: form.get("password"),
            role: form.get("role"),
            status: form.get("status")
          });
          event.currentTarget.reset();
        }}
      >
        <div className="panel__title">
          <Plus size={18} />
          <h3>Crear usuario</h3>
        </div>
        <input name="displayName" placeholder="Nombre visible" required />
        <input name="email" type="email" placeholder="correo@empresa.com" required />
        <input name="password" type="text" placeholder="Contraseña inicial" minLength="8" required />
        <select name="role" defaultValue="player">
          <option value="player">Jugador</option>
          <option value="admin">Administrador</option>
        </select>
        <select name="status" defaultValue="approved">
          <option value="approved">Aprobado</option>
          <option value="pending">Pendiente</option>
          <option value="rejected">Rechazado</option>
        </select>
        <button type="submit">Crear usuario</button>
      </form>

      <div className="table-shell">
        <table className="leaderboard admin-users-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Alta</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((entry) => {
              const isEditing = editingId === entry.id;
              const isResetting = resettingId === entry.id;
              return (
                <tr key={entry.id}>
                  <td>
                    {isEditing ? (
                      <input form={`edit-user-${entry.id}`} name="displayName" defaultValue={entry.display_name} required />
                    ) : entry.display_name}
                  </td>
                  <td>
                    {isEditing ? (
                      <input form={`edit-user-${entry.id}`} name="email" type="email" defaultValue={entry.email} required />
                    ) : entry.email}
                  </td>
                  <td>
                    {isEditing ? (
                      <select form={`edit-user-${entry.id}`} name="role" defaultValue={entry.role}>
                        <option value="player">Jugador</option>
                        <option value="admin">Administrador</option>
                      </select>
                    ) : entry.role}
                  </td>
                  <td>
                    {isEditing ? (
                      <select form={`edit-user-${entry.id}`} name="status" defaultValue={entry.status || "pending"}>
                        <option value="pending">Pendiente</option>
                        <option value="approved">Aprobado</option>
                        <option value="rejected">Rechazado</option>
                      </select>
                    ) : (
                      <span className={`status-badge user-status user-status--${entry.status || "pending"}`}>{entry.status || "pending"}</span>
                    )}
                  </td>
                  <td>{dayjs(entry.created_at).format("DD/MM/YYYY")}</td>
                  <td>
                    {isEditing && (
                      <>
                        <form
                          id={`edit-user-${entry.id}`}
                          onSubmit={(event) => {
                            event.preventDefault();
                            const form = new FormData(event.currentTarget);
                            onUpdateUser(entry.id, {
                              displayName: form.get("displayName"),
                              email: form.get("email"),
                              role: form.get("role"),
                              status: form.get("status")
                            });
                            setEditingId(null);
                          }}
                        />
                        <div className="calendar-actions">
                          <button className="calendar-action save" form={`edit-user-${entry.id}`} type="submit">Guardar</button>
                          <button className="calendar-action cancel" type="button" onClick={() => setEditingId(null)}>Cancelar</button>
                        </div>
                      </>
                    )}

                    {!isEditing && isResetting && (
                      <form
                        className="user-reset-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const form = new FormData(event.currentTarget);
                          onResetUserPassword(entry.id, form.get("password"));
                          setResettingId(null);
                        }}
                      >
                        <input name="password" type="text" placeholder="Nueva contraseña" minLength="8" required />
                        <div className="calendar-actions">
                          <button className="calendar-action save" type="submit">Cambiar</button>
                          <button className="calendar-action cancel" type="button" onClick={() => setResettingId(null)}>Cancelar</button>
                        </div>
                      </form>
                    )}

                    {!isEditing && !isResetting && (
                      <div className="calendar-actions">
                        <button className="calendar-action edit" type="button" onClick={() => setEditingId(entry.id)}>Editar</button>
                        <button className="calendar-action save" type="button" onClick={() => onUpdateUserStatus(entry.id, "approved")} disabled={entry.status === "approved" || entry.role === "admin"}>
                          Aceptar
                        </button>
                        <button className="calendar-action cancel" type="button" onClick={() => setResettingId(entry.id)}>Reset pass</button>
                        <button
                          className="calendar-action delete"
                          type="button"
                          onClick={() => {
                            if (window.confirm(`¿Borrar a ${entry.display_name}? Se eliminarán también sus apuestas.`)) {
                              onDeleteUser(entry.id);
                            }
                          }}
                          disabled={entry.id === currentUserId}
                        >
                          Borrar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminPage({
  data,
  tournament,
  onSaveAdminMatch,
  onSaveAdminQualifier,
  onSaveAdminBonus,
  onSaveOfficialGroupOrder,
  onSendAdminDigest,
  onCreateAdminMatch,
  onUpdateAdminMatch,
  onDeleteAdminMatch,
  onImportOfficialSchedule,
  onUpdateUserStatus,
  onCreateUser,
  onUpdateUser,
  onResetUserPassword,
  onDeleteUser,
  onLogout
}) {
  const { user, admin } = data;
  const teamsByCode = Object.fromEntries(tournament.teams.map((team) => [team.code, team]));
  const adminBonusByKey = Object.fromEntries((admin?.bonusResults ?? []).map((row) => [row.question_key, row.correct_value]));
  const officialGroupOrdersByGroup = Object.fromEntries((admin?.officialGroupOrders ?? []).map((row) => [row.group_name, parseTeamOrder(row.team_order)]));
  const actualQualifiersByGroup = (admin?.qualifiers ?? []).reduce((acc, row) => {
    acc[row.group_name] ??= [];
    acc[row.group_name].push(row.team_code);
    return acc;
  }, {});

  const adminTabs = [
    { key: "groups", label: "Grupos" },
    { key: "round_of_32", label: "Dieciseisavos" },
    { key: "round_of_16", label: "Octavos" },
    { key: "quarterfinals", label: "Cuartos" },
    { key: "semifinals", label: "Semifinales" },
    { key: "final", label: "Final" }
  ];

  const sectionTabs = [
    { key: "results", label: "Resultados" },
    { key: "bonus", label: "Goleador" },
    { key: "users", label: "Usuarios" }
  ];

  const groupTabs = useMemo(() => {
    const groups = [...new Set(admin.matches.filter((match) => match.stage === "groups" && match.group_name).map((match) => match.group_name))];
    return groups.sort().map((group) => ({ key: group, label: `Grupo ${group}` }));
  }, [admin.matches]);

  const [activeSection, setActiveSection] = useState("results");
  const [activeAdminTab, setActiveAdminTab] = useState("groups");
  const [activeGroupTab, setActiveGroupTab] = useState(groupTabs[0]?.key || "A");
  const [showHelp, setShowHelp] = useState(false);
  const matchesByNumber = useMemo(
    () => Object.fromEntries(admin.matches.filter((match) => match.match_number).map((match) => [match.match_number, match])),
    [admin.matches]
  );
  const actualGroupRanks = useMemo(
    () => buildActualGroupRanks(admin.matches, teamsByCode, officialGroupOrdersByGroup),
    [admin.matches, teamsByCode, officialGroupOrdersByGroup]
  );
  const actualThirdAssignments = useMemo(
    () => buildThirdPlaceAssignments(admin.matches, actualGroupRanks),
    [admin.matches, actualGroupRanks]
  );
  const resolveActualTokenToCode = useMemo(() => {
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

      if (/^[12][A-L]$/.test(token)) {
        const resolved = actualGroupRanks[token] || null;
        cache.set(cacheKey, resolved);
        return resolved;
      }

      if (token === "3") {
        const side = contextMatch?.home_team === "3" ? "home_team" : contextMatch?.away_team === "3" ? "away_team" : null;
        const resolved = side ? actualThirdAssignments[`${contextMatch.id}:${side}`] || null : null;
        cache.set(cacheKey, resolved);
        return resolved;
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
        const resolved = getActualWinner(previousMatch, resolvedHome, resolvedAway);
        cache.set(cacheKey, resolved || null);
        return resolved || null;
      }

      cache.set(cacheKey, null);
      return null;
    };

    return resolve;
  }, [actualGroupRanks, actualThirdAssignments, matchesByNumber, teamsByCode]);

  useEffect(() => {
    if (groupTabs.length > 0 && !groupTabs.some((tab) => tab.key === activeGroupTab)) {
      setActiveGroupTab(groupTabs[0].key);
    }
  }, [groupTabs, activeGroupTab]);

  const filteredAdminMatches = admin.matches.filter((match) => {
    if (activeAdminTab === "groups") {
      return match.stage === "groups" && match.group_name === activeGroupTab;
    }
    if (activeAdminTab === "final") {
      return match.stage === "final" || match.stage === "third_place";
    }
    return match.stage === activeAdminTab;
  }).map((match) => {
    if (match.stage === "groups") {
      return match;
    }

    const resolvedHome = resolveActualTokenToCode(match.home_team, match);
    const resolvedAway = resolveActualTokenToCode(match.away_team, match);
    const pendingSources = [
      resolvedHome ? null : getPendingSource(match.home_team),
      resolvedAway ? null : getPendingSource(match.away_team)
    ].filter(Boolean);

    return {
      ...match,
      pendingReason: pendingSources.length > 0 ? `Se rellenará al cerrar ${pendingSources.join(" y ")}` : null,
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
  const completedMatches = admin.matches.filter((match) => match.actual_home_score !== null && match.actual_away_score !== null).length;
  const pendingMatches = admin.matches.length - completedMatches;
  const todayMatches = admin.matches.filter((match) => dayjs(match.kickoff_at).isSame(dayjs(), "day"));

  return (
    <div className="dashboard">
      <header className="topbar">
        <div>
          <img className="brand-logo brand-logo--topbar" src="/delfin-logo.png" alt="Delfin Tubes" />
          <span className="hero-tag">DelfinPorra Admin</span>
          <h1>Panel admin de {user.displayName}</h1>
          <p>Esta vista está separada de la porra del jugador. Aquí solo gestionas resultados, goleador, usuarios y envíos.</p>
        </div>
        <div className="topbar__actions">
          <button className="ghost-button" onClick={() => setShowHelp((value) => !value)}>
            {showHelp ? "Ocultar ayuda" : "Ayuda"}
          </button>
          <button className="ghost-button" onClick={onLogout}>Salir</button>
        </div>
      </header>

      {showHelp && <HelpPanel audience="admin" onClose={() => setShowHelp(false)} />}

      <section className="panel admin-panel">
        <div className="panel__title">
          <Settings size={18} />
          <h3>Panel de administración</h3>
        </div>
        <p className="muted">
          Gestiona el torneo sin mezclar apuestas personales con tareas administrativas.
        </p>

        <div className="admin-toolbar">
          <div className={`status-badge ${admin.mail?.configured ? "ok" : "warn"}`}>
            <Mail size={16} />
            <span>{admin.mail?.configured ? "SMTP configurado" : "SMTP pendiente"}</span>
          </div>
          <button className="admin-action" onClick={onSendAdminDigest} disabled={!admin.mail?.configured}>
            <SendHorizontal size={16} />
            <span>Enviar resumen diario</span>
          </button>
          <button
            className="admin-action admin-action--cyan"
            onClick={() => {
              if (window.confirm("Esto reemplazará los partidos actuales por los oficiales FIFA 2026 y borrará las apuestas ya guardadas. ¿Continuar?")) {
                onImportOfficialSchedule();
              }
            }}
          >
            <Download size={16} />
            <span>Cargar partidos oficiales FIFA</span>
          </button>
        </div>

        <div className="admin-summary-grid">
          <article className="admin-summary-card admin-summary-card--gold">
            <span>Con resultado</span>
            <strong>{completedMatches}</strong>
          </article>
          <article className="admin-summary-card admin-summary-card--cyan">
            <span>Pendientes</span>
            <strong>{pendingMatches}</strong>
          </article>
          <article className="admin-summary-card admin-summary-card--green">
            <span>Hoy</span>
            <strong>{todayMatches.length}</strong>
          </article>
          <article className="admin-summary-card admin-summary-card--pink">
            <span>Jugadores</span>
            <strong>{admin.users.length}</strong>
          </article>
        </div>

        <StageTabs tabs={sectionTabs} activeTab={activeSection} onChange={setActiveSection} />

        {activeSection === "users" && (
          <div className="admin-workspace">
            <div className="panel__title">
              <Users size={18} />
              <h3>Usuarios inscritos</h3>
            </div>
            <AdminUsersManager
              users={admin.users}
              currentUserId={user.id}
              onCreateUser={onCreateUser}
              onUpdateUser={onUpdateUser}
              onUpdateUserStatus={onUpdateUserStatus}
              onResetUserPassword={onResetUserPassword}
              onDeleteUser={onDeleteUser}
            />
            <div className="admin-help-card">
              <ClipboardList size={18} />
              <span>Operativa recomendada: durante el torneo entra en Resultados, selecciona grupo o eliminatoria y publica el resultado. Los clasificados de grupo salen de esos resultados.</span>
            </div>
          </div>
        )}

        {activeSection === "results" && (
          <div className="admin-workspace">
            <div className="panel__title">
              <Target size={18} />
              <h3>Meter resultados oficiales</h3>
            </div>
            <p className="muted">Selecciona el resultado oficial de cada partido. En grupos puedes marcar 1, X o 2; en eliminatorias marcas quién pasa.</p>
            <StageTabs tabs={adminTabs} activeTab={activeAdminTab} onChange={setActiveAdminTab} />
            {activeAdminTab === "groups" && (
              <StageTabs tabs={groupTabs} activeTab={activeGroupTab} onChange={setActiveGroupTab} />
            )}
            <div className="matches-grid">
              {filteredAdminMatches.map((match) => (
                <MatchCard
                  key={`admin-${match.id}`}
                  match={match}
                  prediction={{
                    predicted_home_score: match.actual_home_score,
                    predicted_away_score: match.actual_away_score
                  }}
                  onSave={onSaveAdminMatch}
                  teamsByCode={teamsByCode}
                  buttonLabel="Publicar resultado"
                  savedLabel="Resultado publicado"
                  allowClear
                />
              ))}
            </div>
            {activeAdminTab === "groups" && (
              <OfficialGroupStandings
                groupName={activeGroupTab}
                matches={filteredAdminMatches}
                teamsByCode={teamsByCode}
                groupOrder={officialGroupOrdersByGroup[activeGroupTab] || []}
                onSaveOfficialGroupOrder={onSaveOfficialGroupOrder}
              />
            )}
          </div>
        )}

        {activeSection === "bonus" && (
          <div className="admin-workspace">
            <div className="panel__title">
              <Trophy size={18} />
              <h3>Máximo goleador oficial</h3>
            </div>
            <p className="muted">Al cerrar el torneo, escribe el máximo goleador correcto para repartir el bonus.</p>
            <div className="bonus-grid">
              {tournament.bonusQuestions.map((question) => (
                <form
                  key={`admin-bonus-${question.key}`}
                  className="bonus-card"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    onSaveAdminBonus(question.key, form.get("answer"));
                  }}
                >
                  <span className="pill">{question.points} pts</span>
                  <h4>{question.label}</h4>
                  <ScorerInput
                    value={adminBonusByKey[question.key] || ""}
                  />
                  <button type="submit">Guardar oficial</button>
                </form>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
