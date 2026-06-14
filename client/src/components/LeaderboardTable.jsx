function RankMovement({ row }) {
  if (!row.previousRank) {
    return <span className="rank-movement rank-movement--none">-</span>;
  }

  if (row.rankDelta === 0) {
    return <span className="rank-movement rank-movement--same">=</span>;
  }

  return (
    <span className={`rank-movement ${row.rankDelta > 0 ? "rank-movement--up" : "rank-movement--down"}`}>
      {row.rankDelta > 0 ? `+${row.rankDelta}` : row.rankDelta}
    </span>
  );
}

export function LeaderboardTable({ rows, currentUserId }) {
  return (
    <div className="table-shell table-shell--leaderboard">
      <table className="leaderboard">
        <thead>
          <tr>
            <th>#</th>
            <th>Jugador</th>
            <th>Puntos</th>
            <th>Jornada</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.userId} className={row.userId === currentUserId ? "is-me" : ""}>
              <td className="leaderboard__rank"><span className="rank-pill">#{row.rank}</span></td>
              <td>
                <div className="leaderboard-player">
                  <span className="player-avatar" style={{ "--player-color": row.color }}>{row.initials}</span>
                  <div>
                    <strong>{row.displayName}</strong>
                  </div>
                </div>
              </td>
              <td className="leaderboard__points"><strong>{row.totalPoints}</strong></td>
              <td className="leaderboard__movement"><RankMovement row={row} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
