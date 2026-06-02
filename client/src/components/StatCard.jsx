export function StatCard({ label, value, accent = "cyan" }) {
  return (
    <div className={`stat-card stat-card--${accent}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
