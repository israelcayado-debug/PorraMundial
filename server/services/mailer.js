import nodemailer from "nodemailer";
import dayjs from "dayjs";
import { db } from "../db.js";
import { getLeaderboard } from "../scoring.js";

function getTransport() {
  const host = process.env.EMAIL_HOST;
  if (!host) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_SECURE === "true",
    auth: process.env.EMAIL_USER
      ? {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      : undefined
  });
}

export function buildDigestHtml({ recipientName, leaderboard, me }) {
  const rows = leaderboard
    .map(
      (entry) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e6ecff;">${entry.rank}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e6ecff;">${entry.displayName}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e6ecff;text-align:right;">${entry.totalPoints}</td>
      </tr>`
    )
    .join("");

  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;background:#0b1020;padding:24px;color:#f8fbff;">
      <div style="max-width:680px;margin:0 auto;background:linear-gradient(145deg,#11214e,#1f9ad7);padding:28px;border-radius:24px;">
        <p style="margin:0 0 10px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.8;">Resumen diario · ${dayjs().format("DD/MM/YYYY")}</p>
        <h1 style="margin:0 0 10px;font-size:32px;">Tu porra sigue viva, ${recipientName}</h1>
        <p style="margin:0 0 20px;font-size:16px;line-height:1.5;">
          Ahora mismo vas <strong>${me.rank}º</strong> con <strong>${me.totalPoints} puntos</strong>. Has clavado ${me.exactHits} marcadores exactos.
        </p>
        <div style="background:#ffffff;padding:18px;border-radius:18px;color:#14213d;">
          <h2 style="margin:0 0 14px;font-size:20px;">Clasificación</h2>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr>
                <th style="padding:8px 10px;text-align:left;background:#eef4ff;">#</th>
                <th style="padding:8px 10px;text-align:left;background:#eef4ff;">Jugador</th>
                <th style="padding:8px 10px;text-align:right;background:#eef4ff;">Puntos</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export async function sendDigest({ to, subject, html }) {
  const transport = getTransport();
  if (!transport) {
    throw new Error("EMAIL_HOST no configurado");
  }

  await transport.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject,
    html
  });
}

export async function sendAccountDecisionEmail({ to, displayName, status }) {
  const transport = getTransport();
  if (!transport) {
    return { sent: false, reason: "EMAIL_HOST no configurado" };
  }

  const approved = status === "approved";
  await transport.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject: approved ? "DelfinPorra - usuario aceptado" : "DelfinPorra - solicitud rechazada",
    html: `
      <div style="font-family:Segoe UI,Arial,sans-serif;background:#f3f7fb;padding:24px;color:#102033;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:18px;padding:24px;border:1px solid #d8e3ef;">
          <h1 style="margin:0 0 12px;color:#005b8f;">DelfinPorra</h1>
          <p>Hola ${displayName},</p>
          <p>${approved
            ? "Tu usuario ha sido aceptado. Ya puedes entrar en la porra con tu correo y contraseña."
            : "Tu solicitud de alta ha sido rechazada. Si crees que es un error, contacta con el administrador."}</p>
        </div>
      </div>
    `
  });

  return { sent: true };
}

export async function sendDailyDigestToAllUsers() {
  const leaderboard = getLeaderboard();
  const users = db.prepare("SELECT id, email, display_name FROM users WHERE role = 'player' AND status = 'approved'").all();

  for (const user of users) {
    const me = leaderboard.find((entry) => entry.userId === user.id);
    if (!me) {
      continue;
    }

    const html = buildDigestHtml({
      recipientName: user.display_name,
      leaderboard: leaderboard.slice(0, 10),
      me
    });

    await sendDigest({
      to: user.email,
      subject: `Porra Mundial 2026 · Vas ${me.rank}º con ${me.totalPoints} puntos`,
      html
    });
  }

  return {
    recipients: users.length,
    sentAt: new Date().toISOString()
  };
}
