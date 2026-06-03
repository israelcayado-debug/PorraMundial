import { useState } from "react";
import dayjs from "dayjs";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Trophy, Mail, Shield, Target, Lock, Settings, Users, SendHorizontal, CalendarRange, Pencil, Trash2, Plus } from "lucide-react";
import { LeaderboardTable } from "../components/LeaderboardTable.jsx";
import { MatchCard } from "../components/MatchCard.jsx";
import { StatCard } from "../components/StatCard.jsx";
import { ScorerInput } from "../components/ScorerInput.jsx";

const stageOptions = [
  { value: "groups", label: "Fase de grupos" },
  { value: "round_of_16", label: "Octavos" },
  { value: "quarterfinals", label: "Cuartos" },
  { value: "semifinals", label: "Semifinales" },
  { value: "final", label: "Final" }
];

function toDateTimeLocal(value) {
  if (!value) return "";
  return dayjs(value).format("YYYY-MM-DDTHH:mm");
}

function AdminCalendarEditor({ matches, teamsByCode, onCreate, onUpdate, onDelete }) {
  const [editingId, setEditingId] = useState(null);

  const defaultCreate = {
    stage: "groups",
    groupName: "A",
    kickoffAt: "2026-06-11T19:00",
    homeTeam: "USA",
    awayTeam: "MEX"
  };

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
        <select name="stage" defaultValue={defaultCreate.stage}>
          {stageOptions.map((stage) => <option key={`new-${stage.value}`} value={stage.value}>{stage.label}</option>)}
        </select>
        <input name="groupName" defaultValue={defaultCreate.groupName} placeholder="Grupo (A, B, C...)" />
        <input name="kickoffAt" type="datetime-local" defaultValue={defaultCreate.kickoffAt} required />
        <select name="homeTeam" defaultValue={defaultCreate.homeTeam}>
          {Object.values(teamsByCode).map((team) => <option key={`new-home-${team.code}`} value={team.code}>{team.flag} {team.name}</option>)}
        </select>
        <select name="awayTeam" defaultValue={defaultCreate.awayTeam}>
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
                      match.group_name || "-"
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

export function DashboardPage({
  data,
  tournament,
  onSavePrediction,
  onSaveQualifier,
  onSaveBonus,
  onSaveAdminMatch,
  onSaveAdminQualifier,
  onSaveAdminBonus,
  onSendAdminDigest,
  onCreateAdminMatch,
  onUpdateAdminMatch,
  onDeleteAdminMatch,
  onLogout
}) {
  const { user, dashboard, predictions, qualifiers, bonusAnswers, admin } = data;
  const teamsByCode = Object.fromEntries(tournament.teams.map((team) => [team.code, team]));
  const predictionsByMatch = Object.fromEntries(predictions.map((row) => [row.match_id, row]));
  const qualifiersByGroup = Object.fromEntries(qualifiers.map((row) => [row.group_name, row]));
  const bonusByKey = Object.fromEntries(bonusAnswers.map((row) => [row.question_key, row.answer_value]));
  const adminBonusByKey = Object.fromEntries((admin?.bonusResults ?? []).map((row) => [row.question_key, row.correct_value]));

  const actualQualifiersByGroup = (admin?.qualifiers ?? []).reduce((acc, row) => {
    acc[row.group_name] ??= [];
    acc[row.group_name].push(row.team_code);
    return acc;
  }, {});

  const betsLocked = Boolean(tournament.settings?.betsLocked);
  const closesAtLabel = tournament.settings?.bettingClosesAt
    ? dayjs(tournament.settings.bettingClosesAt).format("DD/MM/YYYY HH:mm")
    : "sin definir";

  return (
    <div className="dashboard">
      <header className="topbar">
        <div>
          <span className="hero-tag">Porra Mundial 2026</span>
          <h1>Hola, {user.displayName}</h1>
          <p>Clasificación viva, apuestas rápidas y un diseño pensado para usarlo desde móvil o PC dentro de tu red.</p>
        </div>
        <div className="topbar__actions">
          <button className="ghost-button" onClick={onLogout}>Salir</button>
        </div>
      </header>

      <section className="hero-panel">
        <div className="hero-panel__content">
          <div className="hero-panel__headline">
            <Trophy size={28} />
            <div>
              <h2>{dashboard.me?.rank ?? "-"}º puesto</h2>
              <p>{dashboard.me?.totalPoints ?? 0} puntos totales</p>
            </div>
          </div>
          <div className="stats-grid">
            <StatCard label="Pronósticos hechos" value={dashboard.stats.filledPredictions} />
            <StatCard label="Pendientes" value={dashboard.stats.pendingPredictions} accent="gold" />
            <StatCard label="Jugadores" value={dashboard.stats.users} accent="green" />
            <StatCard label="Marcadores exactos" value={dashboard.me?.exactHits ?? 0} accent="pink" />
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
            <Mail size={18} />
            <h3>Correo diario</h3>
          </div>
          <p className="muted">
            Puedes seguir lanzándolo por terminal o, si eres admin, desde el panel de administración. Solo necesitas configurar SMTP en `.env`.
          </p>
          <div className="mail-preview">
            <span>Resumen de posición</span>
            <span>Evolución de puntos</span>
            <span>Top 10 del día</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__title">
          <Target size={18} />
          <h3>Resultados de partidos</h3>
        </div>
        <div className="matches-grid">
          {tournament.matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              prediction={predictionsByMatch[match.id]}
              onSave={onSavePrediction}
              teamsByCode={teamsByCode}
              disabled={betsLocked}
              buttonLabel={betsLocked ? "Cerrado" : "Guardar"}
            />
          ))}
        </div>
      </section>

      <section className="content-grid">
        <div className="panel">
          <div className="panel__title">
            <Shield size={18} />
            <h3>Equipos que pasan de fase</h3>
          </div>
          <div className="qualifiers-grid">
            {tournament.qualifierGroups.map((group) => {
              const current = qualifiersByGroup[group.group_name];
              const options = group.teams.split(",");
              return (
                <form
                  key={group.group_name}
                  className="qualifier-card"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    onSaveQualifier(group.group_name, form.get("first"), form.get("second"));
                  }}
                >
                  <h4>Grupo {group.group_name}</h4>
                  <select name="first" defaultValue={current?.first_team || options[0]} disabled={betsLocked}>
                    {options.map((code) => (
                      <option key={`${group.group_name}-${code}-1`} value={code}>{teamsByCode[code]?.flag} {teamsByCode[code]?.name}</option>
                    ))}
                  </select>
                  <select name="second" defaultValue={current?.second_team || options[1] || options[0]} disabled={betsLocked}>
                    {options.map((code) => (
                      <option key={`${group.group_name}-${code}-2`} value={code}>{teamsByCode[code]?.flag} {teamsByCode[code]?.name}</option>
                    ))}
                  </select>
                  <button type="submit" disabled={betsLocked}>{betsLocked ? "Cerrado" : "Guardar grupo"}</button>
                </form>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <div className="panel__title">
            <Trophy size={18} />
            <h3>Bonus sencillos</h3>
          </div>
          <div className="bonus-grid">
            {tournament.bonusQuestions.map((question) => (
              <form
                key={question.key}
                className="bonus-card"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  onSaveBonus(question.key, form.get("answer"));
                }}
              >
                <span className="pill">{question.points} pts</span>
                <h4>{question.label}</h4>
                <ScorerInput
                  value={bonusByKey[question.key] || ""}
                  disabled={betsLocked}
                />
                <button type="submit" disabled={betsLocked}>{betsLocked ? "Cerrado" : "Guardar bonus"}</button>
              </form>
            ))}
          </div>
        </div>
      </section>

      {user.role === "admin" && admin && (
        <section className="panel admin-panel">
          <div className="panel__title">
            <Settings size={18} />
            <h3>Panel de administración</h3>
          </div>
          <p className="muted">
            Publica resultados reales, fija clasificados, revisa usuarios, edita el calendario completo y lanza el resumen diario sin tocar la terminal.
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
          </div>

          <div className="content-grid admin-grid">
            <div className="admin-column">
              <div className="panel__title">
                <Users size={18} />
                <h3>Usuarios inscritos</h3>
              </div>
              <div className="table-shell">
                <table className="leaderboard admin-users-table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Correo</th>
                      <th>Rol</th>
                      <th>Alta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admin.users.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.display_name}</td>
                        <td>{entry.email}</td>
                        <td>{entry.role}</td>
                        <td>{dayjs(entry.created_at).format("DD/MM/YYYY")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="panel__title">
                <CalendarRange size={18} />
                <h3>Editor del calendario completo</h3>
              </div>
              <AdminCalendarEditor
                matches={admin.matches}
                teamsByCode={teamsByCode}
                onCreate={onCreateAdminMatch}
                onUpdate={onUpdateAdminMatch}
                onDelete={onDeleteAdminMatch}
              />
            </div>

            <div className="admin-column">
              <h4>Resultados oficiales</h4>
              <div className="matches-grid">
                {admin.matches.map((match) => (
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
                  />
                ))}
              </div>

              <h4>Clasificados reales</h4>
              <div className="qualifiers-grid">
                {tournament.qualifierGroups.map((group) => {
                  const options = group.teams.split(",");
                  const actual = actualQualifiersByGroup[group.group_name] || options;
                  return (
                    <form
                      key={`admin-group-${group.group_name}`}
                      className="qualifier-card"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const form = new FormData(event.currentTarget);
                        onSaveAdminQualifier(group.group_name, form.get("first"), form.get("second"));
                      }}
                    >
                      <h4>Grupo {group.group_name}</h4>
                      <select name="first" defaultValue={actual[0] || options[0]}>
                        {options.map((code) => (
                          <option key={`actual-${group.group_name}-${code}-1`} value={code}>{teamsByCode[code]?.flag} {teamsByCode[code]?.name}</option>
                        ))}
                      </select>
                      <select name="second" defaultValue={actual[1] || options[1] || options[0]}>
                        {options.map((code) => (
                          <option key={`actual-${group.group_name}-${code}-2`} value={code}>{teamsByCode[code]?.flag} {teamsByCode[code]?.name}</option>
                        ))}
                      </select>
                      <button type="submit">Guardar clasificados</button>
                    </form>
                  );
                })}
              </div>

              <h4>Bonus oficiales</h4>
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
                    <select name="answer" defaultValue={adminBonusByKey[question.key] || question.options[0]}>
                      {question.options.map((option) => (
                        <option key={`official-${question.key}-${option}`} value={option}>{option}</option>
                      ))}
                    </select>
                    <button type="submit">Guardar oficial</button>
                  </form>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
