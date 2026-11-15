import { getStore } from "@netlify/blobs";

function madridClock(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(date);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

export default async function handler() {
  const local = madridClock();
  // Netlify cron usa UTC. Ejecutamos a las 22:00 y 23:00 UTC y solo
  // hacemos la rotación cuando en España peninsular son las 00:00.
  if (local.hour !== "00" || local.minute !== "00") {
    return new Response("No es medianoche en Europe/Madrid; sin cambios.");
  }

  const date = `${local.year}-${local.month}-${local.day}`;
  const store = getStore("promathsy-daily-questions");
  await store.setJSON("active-day", { date, rotatedAt: new Date().toISOString(), timezone: "Europe/Madrid" });
  console.log(`Promathsy: nueva jornada de preguntas ${date}`);
  return new Response(`Preguntas del día activadas: ${date}`);
}

// Europa/Madrid es UTC+1 en invierno y UTC+2 en verano.
// Las dos horas cubren el cambio estacional; la comprobación anterior
// garantiza que solo se active una vez, exactamente a las 00:00 locales.
export const config = { schedule: "0 22,23 * * *" };
