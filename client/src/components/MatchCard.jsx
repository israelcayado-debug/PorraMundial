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

const FLAG_IMAGE_CODES = {
  ALG: "dz",
  ARG: "ar",
  AUS: "au",
  AUT: "at",
  BEL: "be",
  BIH: "ba",
  BRA: "br",
  CAN: "ca",
  CIV: "ci",
  COD: "cd",
  COL: "co",
  CPV: "cv",
  CRO: "hr",
  CUW: "cw",
  CZE: "cz",
  ECU: "ec",
  EGY: "eg",
  ENG: "gb-eng",
  ESP: "es",
  FRA: "fr",
  GER: "de",
  GHA: "gh",
  HAI: "ht",
  IRQ: "iq",
  IRN: "ir",
  JOR: "jo",
  JPN: "jp",
  KOR: "kr",
  KSA: "sa",
  MAR: "ma",
  MEX: "mx",
  NED: "nl",
  NOR: "no",
  NZL: "nz",
  PAN: "pa",
  PAR: "py",
  POR: "pt",
  QAT: "qa",
  RSA: "za",
  SCO: "gb-sct",
  SEN: "sn",
  SUI: "ch",
  SWE: "se",
  TUN: "tn",
  TUR: "tr",
  URU: "uy",
  USA: "us",
  UZB: "uz"
};

export function FlagBadge({ code, label, flag }) {
  const imageCode = FLAG_IMAGE_CODES[code];
  const flagUrl = imageCode ? `https://flagcdn.com/${imageCode}.svg` : null;

  return (
    <span
      className="flag-badge"
      aria-label={`Bandera de ${label}`}
      title={label}
    >
      {flagUrl ? (
        <img src={flagUrl} alt="" loading="lazy" />
      ) : (
        <span>{flag || code?.slice(0, 2) || "?"}</span>
      )}
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
  const hasSavedPrediction = prediction?.predicted_home_score !== undefined
    && prediction?.predicted_away_score !== undefined
    && prediction?.predicted_home_score !== null
    && prediction?.predicted_away_score !== null;
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
          <FlagBadge code={home.code} label={home.name} flag={home.flag} />
          <strong>{home.name}</strong>
        </div>
        <span className="vs">vs</span>
        <div className="match-team">
          <FlagBadge code={away.code} label={away.name} flag={away.flag} />
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
