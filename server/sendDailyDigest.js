import { sendDailyDigestToAllUsers } from "./services/mailer.js";

async function main() {
  const result = await sendDailyDigestToAllUsers();
  console.log(`Resumen enviado a ${result.recipients} usuarios.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
