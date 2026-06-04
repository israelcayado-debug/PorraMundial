export function LeaderboardTable({ rows, currentUserId }) {
  return (
    <div className="table-shell table-shell--leaderboard">
      <table className="leaderboard">
        <thead>
          <tr>
            <th>#</th>
            <th>Jugador</th>
            <th>Puntos</th>
            <th>Cuadro</th>
            <th>Aciertos 1/X/2</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.userId} className={row.userId === currentUserId ? "is-me" : ""}>
              <td><span className="rank-pill">#{row.rank}</span></td>
              <td>
                <div className="leaderboard-player">
                  <span className="player-avatar" style={{ "--player-color": row.color }}>{row.initials}</span>
                  <div>
                    <strong>{row.displayName}</strong>
                    <span>{row.bracketPoints} pts cuadro · {row.qualifierPoints} pts grupos · {row.bonusPoints} pts bonus</span>
                  </div>
                  {row.rankDelta !== 0 && (
                    <span className={`rank-delta ${row.rankDelta > 0 ? "up" : "down"}`}>
                      {row.rankDelta > 0 ? `+${row.rankDelta}` : row.rankDelta}
                    </span>
                  )}
                </div>
              </td>
              <td><strong>{row.totalPoints}</strong></td>
              <td>{row.bracketPoints}</td>
              <td>{row.outcomeHits}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
