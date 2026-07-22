import { HelpCircle, Shield, Trophy, Users } from "lucide-react";

export function HelpPanel({ audience = "player", onClose }) {
  const isAdmin = audience === "admin";

  return (
    <section className="panel help-panel">
      <div className="panel__title help-panel__title">
        <div>
          <HelpCircle size={20} />
          <h3>Ayuda de DelfinPorra</h3>
        </div>
        <button type="button" className="ghost-button" onClick={onClose}>Cerrar ayuda</button>
      </div>

      <div className="help-grid">
        <article className="help-card help-card--primary">
          <Trophy size={22} />
          <h4>Cómo se juega</h4>
          <p>Antes del bloqueo cada jugador rellena la fase de grupos, las eliminatorias y el máximo goleador.</p>
          <ul>
            <li>En grupos se elige 1, X o 2 para cada partido.</li>
            <li>Si hay empate a puntos en un grupo, ordena los empatados con Subir/Bajar.</li>
            <li>En eliminatorias se elige qué selección pasa de ronda.</li>
            <li>El máximo goleador se escribe libremente, sin lista cerrada.</li>
          </ul>
        </article>

        <article className="help-card">
          <Shield size={22} />
          <h4>Puntuación</h4>
          <ul>
            <li>Partido acertado de fase de grupos: 2 puntos.</li>
            <li>Acertar todos los partidos de un mismo grupo: 8 puntos.</li>
            <li>Equipo clasificado para dieciseisavos: 5 puntos en su cruce correcto y 3 puntos si aparece en otro cruce.</li>
            <li>Equipo acertado que pasa de octavos: 6 puntos.</li>
            <li>Equipo acertado que pasa de cuartos: 7 puntos.</li>
            <li>Equipo acertado que pasa de semifinales: 8 puntos.</li>
            <li>Acertar tercer clasificado: 10 puntos.</li>
            <li>Acertar el campeón: 12 puntos.</li>
            <li>Acertar el máximo goleador: 12 puntos.</li>
          </ul>
        </article>

        <article className="help-card help-card--primary">
          <Trophy size={22} />
          <h4>Premios</h4>
          <p>El reparto se calcula sobre el dinero recaudado en la porra.</p>
          <ul>
            <li>Primero se apartan 5 € para el último clasificado, que recupera su apuesta.</li>
            <li>Del dinero restante, el 70 % es para el primer clasificado.</li>
            <li>Del dinero restante, el 30 % es para el segundo clasificado.</li>
          </ul>
        </article>

        <article className="help-card">
          <Users size={22} />
          <h4>Empates y desempates</h4>
          <p>Si hay empate dentro de un grupo, el jugador fija el orden previsto con Subir/Bajar.</p>
          <ul>
            <li>El administrador hará lo mismo con la clasificación real si hay empate oficial, sorteo o criterio externo.</li>
            <li>Si dos jugadores empatan a puntos, se desempata por campeón, máximo goleador y aciertos por rondas.</li>
            <li>Si siguen empatados después de todos los criterios, comparten posición y premio.</li>
          </ul>
        </article>

        {isAdmin ? (
          <article className="help-card help-card--admin">
            <HelpCircle size={22} />
            <h4>Uso del administrador</h4>
            <ul>
              <li>En Resultados se introducen los resultados oficiales de grupos y quién pasa en eliminatorias.</li>
              <li>Los cruces se rellenan automáticamente al cerrar grupos y rondas anteriores.</li>
              <li>En Usuarios se aceptan participantes después del pago, se crean usuarios y se resetean contraseñas.</li>
              <li>En Goleador se escribe el máximo goleador oficial al terminar el Mundial.</li>
            </ul>
          </article>
        ) : (
          <article className="help-card help-card--admin">
            <HelpCircle size={22} />
            <h4>Consejos para jugadores</h4>
            <ul>
              <li>Rellena primero todos los grupos para que se calculen tus cruces.</li>
              <li>Después entra en Eliminatorias y selecciona quién pasa ronda a ronda.</li>
              <li>Revisa el panel superior: muestra pendientes, puntos y evolución.</li>
              <li>Cuando el admin publique resultados verás tu puntuación en Seguimiento de resultados.</li>
            </ul>
          </article>
        )}
      </div>
    </section>
  );
}
