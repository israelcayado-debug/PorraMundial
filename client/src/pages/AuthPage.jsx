import { useState } from "react";
import { Eye, EyeOff, ShieldCheck, Trophy, Mail, Sparkles } from "lucide-react";
import { api, appAsset, saveSession } from "../lib.js";

const initialRegister = { displayName: "", email: "", password: "", confirmPassword: "" };
const initialLogin = { email: "", password: "" };

export function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [loginForm, setLoginForm] = useState(initialLogin);
  const [registerForm, setRegisterForm] = useState(initialRegister);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    try {
      if (mode === "register") {
        if (registerForm.password.length < 8) {
          throw new Error("La contraseña debe tener al menos 8 caracteres");
        }
        if (registerForm.password !== registerForm.confirmPassword) {
          throw new Error("Las contraseñas no coinciden");
        }
      }

      const payload = mode === "login"
        ? loginForm
        : {
            displayName: registerForm.displayName,
            email: registerForm.email,
            password: registerForm.password
          };
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const data = await api(endpoint, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (mode === "register" && data.pendingApproval) {
        setRegisterForm(initialRegister);
        setMode("login");
        setNotice(data.message || "Usuario creado. Queda pendiente de aprobación.");
        return;
      }

      saveSession(data.token, data.user);
      onAuthenticated(data.user);
    } catch (err) {
      setError(err.message);
    }
  };

  const active = mode === "login" ? loginForm : registerForm;
  const setActive = mode === "login" ? setLoginForm : setRegisterForm;
  const passwordStrength = mode === "register"
    ? Math.min(100, registerForm.password.length * 12 + (/\d/.test(registerForm.password) ? 20 : 0) + (/[A-Z]/.test(registerForm.password) ? 20 : 0))
    : 0;

  return (
    <section className="auth-page">
      <div className="hero-copy">
        <img className="brand-logo" src={appAsset("delfin-logo.png")} alt="Delfin Tubes" />
        <span className="hero-tag">DelfinPorra 2026</span>
        <h1>DelfinPorra, la porra mundialista de Delfin Tubes.</h1>
        <p>
          Registra tus marcadores, cruces y máximo goleador. El acceso se activa cuando el administrador confirma el pago de la porra.
        </p>
        <div className="hero-badges">
          <span>Banderas y color</span>
          <span>Ranking diario</span>
          <span>Correos automáticos</span>
        </div>
        <div className="auth-feature-grid">
          <article className="auth-feature-card">
            <Trophy size={20} />
            <strong>Porra completa</strong>
            <span>Grupos, eliminatorias, goleador y seguimiento de puntos.</span>
          </article>
          <article className="auth-feature-card">
            <ShieldCheck size={20} />
            <strong>Alta revisada</strong>
            <span>Creas la cuenta, pagas la porra y el administrador acepta tu acceso.</span>
          </article>
          <article className="auth-feature-card">
            <Mail size={20} />
            <strong>Resumen diario</strong>
            <span>Clasificación, evolución de puntos y quién sube o baja cada jornada.</span>
          </article>
        </div>
      </div>

      <div className="auth-shell">
        <div className="auth-shell__header">
          <div>
            <span className="hero-tag">Zona privada</span>
            <h2>{mode === "login" ? "Entra en DelfinPorra" : "Solicita tu alta"}</h2>
          </div>
          <Sparkles size={20} />
        </div>
        <div className="auth-tabs">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Entrar</button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Solicitar alta</button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {mode === "register" && (
            <label>
              Nombre visible
              <input
                value={active.displayName}
                onChange={(event) => setActive((prev) => ({ ...prev, displayName: event.target.value }))}
                placeholder="Ej. Marta, Equipo Ventas"
                required
              />
            </label>
          )}
          <label>
            Correo
            <input
              type="email"
              value={active.email}
              onChange={(event) => setActive((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="tu.correo@empresa.com"
              required
            />
          </label>
          <label>
            Contraseña
            <div className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                value={active.password}
                onChange={(event) => setActive((prev) => ({ ...prev, password: event.target.value }))}
                placeholder={mode === "login" ? "Tu contraseña" : "Mínimo 8 caracteres"}
                required
              />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((prev) => !prev)}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          {mode === "register" && (
            <>
              <label>
                Repite la contraseña
                <input
                  type={showPassword ? "text" : "password"}
                  value={registerForm.confirmPassword}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                  placeholder="Repite tu contraseña"
                  required
                />
              </label>
              <div className="password-meter">
                <div className="password-meter__bar">
                  <span style={{ width: `${passwordStrength}%` }} />
                </div>
                <small>
                  {passwordStrength < 45 ? "Contraseña débil" : passwordStrength < 80 ? "Contraseña aceptable" : "Contraseña sólida"}
                </small>
              </div>
            </>
          )}

          {error && <p className="error-box">{error}</p>}
          {notice && <p className="success-box">{notice}</p>}

          <button className="primary-button" type="submit">
            {mode === "login" ? "Entrar en DelfinPorra" : "Solicitar alta"}
          </button>
        </form>

        <div className="auth-footer-note">
          <span>Acceso privado por correo</span>
          <span>Alta después del pago</span>
          <span>Seguimiento de puntos</span>
        </div>
      </div>
    </section>
  );
}
