import dayjs from "dayjs";

const STAGE_LABELS = {
  groups: "Grupos",
  round_of_32: "Dieciseisavos",
  round_of_16: "Octavos",
  quarterfinals: "Cuartos",
  semifinals: "Semifinales",
  third_place: "Tercer puesto",
  final: "Final"
};

const FLAG_STYLES = {
  ALG: ["#006233", "#ffffff", "#d21034"],
  ARG: ["#74acdf", "#ffffff", "#74acdf"],
  AUS: ["#012169", "#ffffff", "#e4002b"],
  AUT: ["#ed2939", "#ffffff", "#ed2939"],
  BEL: ["#000000", "#ffd90c", "#ef3340"],
  BIH: ["#002f6c", "#ffcd00", "#ffffff"],
  BRA: ["#009b3a", "#ffdf00", "#002776"],
  CAN: ["#ff0000", "#ffffff", "#ff0000"],
  CIV: ["#f77f00", "#ffffff", "#009e60"],
  COD: ["#007fff", "#f7d618", "#ce1021"],
  COL: ["#fcd116", "#003893", "#ce1126"],
  CPV: ["#003893", "#ffffff", "#cf2027"],
  CRO: ["#ff0000", "#ffffff", "#171796"],
  CUW: ["#002b7f", "#f9e814", "#ffffff"],
  CZE: ["#ffffff", "#d7141a", "#11457e"],
  ECU: ["#ffdd00", "#034ea2", "#ed1c24"],
  EGY: ["#ce1126", "#ffffff", "#000000"],
  ENG: ["#ffffff", "#ce1126", "#ffffff"],
  ESP: ["#aa151b", "#f1bf00", "#aa151b"],
  FRA: ["#0055a4", "#ffffff", "#ef4135"],
  GER: ["#000000", "#dd0000", "#ffce00"],
  GHA: ["#ce1126", "#fcd116", "#006b3f"],
  HAI: ["#00209f", "#d21034", "#ffffff"],
  IRQ: ["#ce1126", "#ffffff", "#000000"],
  IRN: ["#239f40", "#ffffff", "#da0000"],
  JOR: ["#000000", "#ffffff", "#007a3d"],
  JPN: ["#ffffff", "#bc002d", "#ffffff"],
  KOR: ["#ffffff", "#c60c30", "#003478"],
  KSA: ["#006c35", "#ffffff", "#006c35"],
  MAR: ["#c1272d", "#006233", "#c1272d"],
  MEX: ["#006847", "#ffffff", "#ce1126"],
  NED: ["#ae1c28", "#ffffff", "#21468b"],
  NOR: ["#ba0c2f", "#ffffff", "#00205b"],
  NZL: ["#00247d", "#ffffff", "#cc142b"],
  PAN: ["#ffffff", "#d21034", "#005293"],
  PAR: ["#d52b1e", "#ffffff", "#0038a8"],
  POR: ["#006600", "#ff0000", "#ffcc00"],
  QAT: ["#ffffff", "#8a1538", "#8a1538"],
  RSA: ["#007a4d", "#ffb81c", "#de3831"],
  SCO: ["#005eb8", "#ffffff", "#005eb8"],
  SEN: ["#00853f", "#fdef42", "#e31b23"],
  SUI: ["#d52b1e", "#ffffff", "#d52b1e"],
  SWE: ["#006aa7", "#fecc00", "#006aa7"],
  TUN: ["#e70013", "#ffffff", "#e70013"],
  TUR: ["#e30a17", "#ffffff", "#e30a17"],
  URU: ["#ffffff", "#0038a8", "#fcd116"],
  USA: ["#b22234", "#ffffff", "#3c3b6e"],
  UZB: ["#1eb53a", "#ffffff", "#0099b5"]
};

export function FlagBadge({ code, label }) {
  const colors = FLAG_STYLES[code] ?? ["#dce8ff", "#7b8ca8", "#233650"];
  return (
    <span
      className="flag-badge"
      style={{
        "--flag-a": colors[0],
        "--flag-b": colors[1],
        "--flag-c": colors[2]
      }}
      aria-label={`Bandera de ${label}`}
      title={label}
    >
      <span>{code?.slice(0, 2) || "?"}</span>
    </span>
  );
}

function getParticipantLabel(code, match, teamsByCode) {
  if (match.participantLabels?.[code]) {
    return {
      code: match.participantLabels[code].code || code,
      ...match.participantLabels[code]
    };
  }

  const team = teamsByCode[code];
  if (team) {
    return {
      code,
      flag: team.flag,
      name: team.name
    };
  }

  const standingMatch = /^([12])([A-L])$/.exec(code || "");
  if (standingMatch) {
    return {
      code: null,
      flag: "",
      name: `${standingMatch[1]}º del Grupo ${standingMatch[2]}`
    };
  }

  if (code === "3") {
    const eligibleGroups = (match.group_name || "").split("").filter(Boolean).join(", ");
    return {
      code: null,
      flag: "",
      name: eligibleGroups ? `Mejor 3º (${eligibleGroups})` : "Mejor 3º"
    };
  }

  const winnerMatch = /^W(\d+)$/.exec(code || "");
  if (winnerMatch) {
    return {
      code: null,
      flag: "",
      name: `Ganador del partido ${winnerMatch[1]}`
    };
  }

  const loserMatch = /^L(\d+)$/.exec(code || "");
  if (loserMatch) {
    return {
      code: null,
      flag: "",
      name: `Perdedor del partido ${loserMatch[1]}`
    };
  }

  return {
    code: null,
    flag: "",
    name: code
  };
}

export function MatchCard({
  match,
  prediction,
  onSave,
  teamsByCode,
  disabled = false,
  buttonLabel = "Guardar",
  savedLabel = "Apuesta guardada",
  savedValueLabel,
  allowClear = false
}) {
  const home = getParticipantLabel(match.home_team, match, teamsByCode);
  const away = getParticipantLabel(match.away_team, match, teamsByCode);
  const hasSavedPrediction = prediction?.predicted_home_score !== undefined && prediction?.predicted_away_score !== undefined;
  const allowsDraw = match.stage === "groups";
  const isKnockout = !allowsDraw;
  const selectedOutcome = hasSavedPrediction
    ? prediction.predicted_home_score === prediction.predicted_away_score
      ? "draw"
      : prediction.predicted_home_score > prediction.predicted_away_score
        ? "home"
        : "away"
    : null;

  const submit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSave(match.id, Number(form.get("home")), Number(form.get("away")));
  };

  const saveOutcome = (outcome) => {
    if (allowClear && selectedOutcome === outcome) {
      onSave(match.id, null, null);
      return;
    }

    if (outcome === "home") {
      onSave(match.id, 1, 0);
    } else if (outcome === "away") {
      onSave(match.id, 0, 1);
    } else {
      onSave(match.id, 0, 0);
    }
  };

  return (
    <article className={`match-card ${hasSavedPrediction ? "is-predicted" : ""}`}>
      <div className="match-card__header">
        <span className="pill">{match.match_number ? `#${match.match_number}` : (match.stageLabel || STAGE_LABELS[match.stage] || match.stage)}</span>
        <span>{dayjs(match.kickoff_at).format("DD MMM · HH:mm")}</span>
      </div>
      <div className="match-card__teams">
        <div className="match-team">
          <FlagBadge code={home.code} label={home.name} />
          <strong>{home.name}</strong>
        </div>
        <span className="vs">vs</span>
        <div className="match-team">
          <FlagBadge code={away.code} label={away.name} />
          <strong>{away.name}</strong>
        </div>
      </div>
      {match.pendingReason && (
        <div className="match-card__pending">{match.pendingReason}</div>
      )}
      <div className="outcome-picker" role="group" aria-label={`Resultado de ${home.name} contra ${away.name}`}>
        <button
          type="button"
          title={isKnockout ? `Pasa ${home.name}` : `Gana ${home.name}`}
          className={selectedOutcome === "home" ? "active" : ""}
          onClick={() => saveOutcome("home")}
          disabled={disabled}
        >
          <strong>{isKnockout ? home.name : "1"}</strong>
        </button>
        {allowsDraw && (
          <button
            type="button"
            className={selectedOutcome === "draw" ? "active" : ""}
            onClick={() => saveOutcome("draw")}
            disabled={disabled}
          >
            <strong>X</strong>
          </button>
        )}
        <button
          type="button"
          title={isKnockout ? `Pasa ${away.name}` : `Gana ${away.name}`}
          className={selectedOutcome === "away" ? "active" : ""}
          onClick={() => saveOutcome("away")}
          disabled={disabled}
        >
          <strong>{isKnockout ? away.name : "2"}</strong>
        </button>
      </div>
      {hasSavedPrediction && (
        <div className="match-card__saved">
          <span>{savedLabel}</span>
          <strong>{savedValueLabel || (selectedOutcome === "home" ? (isKnockout ? home.name : "1") : selectedOutcome === "away" ? (isKnockout ? away.name : "2") : allowsDraw ? "X" : "Pendiente")}</strong>
        </div>
      )}
    </article>
  );
}
