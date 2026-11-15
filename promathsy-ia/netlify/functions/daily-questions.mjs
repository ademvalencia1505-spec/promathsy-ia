import { getStore } from "@netlify/blobs";

const CURRICULUM = {
  "Primaria": {
    "1.º de Primaria": ["Sumas", "Restas", "Geometría"],
    "2.º de Primaria": ["Sumas", "Restas", "Multiplicaciones", "Geometría"],
    "3.º de Primaria": ["Sumas", "Restas", "Multiplicaciones", "Divisiones", "Fracciones"],
    "4.º de Primaria": ["Operaciones combinadas", "Multiplicaciones", "Divisiones", "Fracciones", "Decimales", "Geometría"],
    "5.º de Primaria": ["Operaciones combinadas", "Fracciones", "Decimales", "Porcentajes", "Proporcionalidad", "Geometría"],
    "6.º de Primaria": ["Operaciones combinadas", "Fracciones", "Decimales", "Porcentajes", "Proporcionalidad", "Estadística", "Geometría"]
  },
  "ESO": {
    "1.º de ESO": ["Números enteros", "Fracciones", "Decimales", "Operaciones combinadas", "Potencias", "Proporcionalidad", "Álgebra", "Geometría", "Estadística"],
    "2.º de ESO": ["Números enteros", "Fracciones", "Decimales", "Potencias", "Porcentajes", "Proporcionalidad", "Álgebra", "Geometría", "Estadística"],
    "3.º de ESO": ["Números enteros", "Fracciones", "Decimales", "Potencias", "Porcentajes", "Proporcionalidad", "Álgebra", "Geometría", "Estadística"],
    "4.º de ESO": ["Fracciones", "Decimales", "Potencias", "Porcentajes", "Proporcionalidad", "Álgebra", "Geometría", "Estadística"]
  }
};

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          q: { type: "string" },
          a: { type: "array", items: { type: "string" } },
          c: { type: "integer", enum: [0, 1, 2, 3] },
          e: { type: "string" }
        },
        required: ["q", "a", "c", "e"]
      }
    }
  },
  required: ["questions"]
};

function madridDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(date);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function dateLabel(isoDate) {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function previousDate(isoDate) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function slug(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function validateQuestions(questions) {
  if (!Array.isArray(questions) || questions.length !== 5) return false;
  return questions.every(q =>
    q && typeof q.q === "string" && q.q.trim().length > 5 &&
    Array.isArray(q.a) && q.a.length === 4 && q.a.every(a => typeof a === "string" && a.trim()) &&
    new Set(q.a.map(a => a.trim())).size === 4 &&
    Number.isInteger(q.c) && q.c >= 0 && q.c <= 3 &&
    typeof q.e === "string" && q.e.trim().length > 5
  );
}

async function generateQuestions({ apiKey, model, stage, course, topic, date, previous }) {
  const previousList = previous?.questions?.map(item => item.q).filter(Boolean) ?? [];
  const system = `Eres un profesor excelente de matemáticas del sistema educativo español. Diseñas ejercicios rigurosos, claros y adecuados a la edad. No inventes datos ambiguos. Comprueba internamente cada operación y que solo una opción sea correcta. Devuelve únicamente el objeto que cumpla el esquema JSON.`;
  const user = `Crea exactamente 5 preguntas NUEVAS de matemáticas para la web de aprendizaje.
Etapa: ${stage}.
Curso: ${course}.
Tema: ${topic}.
Fecha de la colección: ${date} (zona horaria Europe/Madrid).

Requisitos:
- Ajusta vocabulario, dificultad y operaciones al curso indicado.
- Mezcla dificultad fácil, media y un reto razonable.
- Cada pregunta tendrá exactamente cuatro respuestas posibles y una única respuesta correcta.
- El campo c es el índice de la respuesta correcta empezando por 0.
- En e, explica el procedimiento paso a paso de forma breve y pedagógica.
- Usa la coma decimal en español y notación matemática legible.
- Cambia números, contextos y planteamientos respecto a días anteriores.
- No repitas ni reformules estas preguntas anteriores: ${JSON.stringify(previousList)}.
- No añadas saludos, títulos, texto fuera del JSON ni preguntas de otras materias.

Genera preguntas variadas y verifica los resultados antes de entregarlas.`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 2200,
      input: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "daily_math_questions",
          strict: true,
          schema: RESPONSE_SCHEMA
        }
      }
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("OpenAI API error:", response.status, payload?.error?.message || payload);
    throw new Error("La IA no ha podido generar las preguntas.");
  }

  const outputText = (payload.output || [])
    .flatMap(item => item.content || [])
    .find(item => item.type === "output_text")?.text;
  if (!outputText) throw new Error("La IA ha devuelto una respuesta vacía.");

  const parsed = JSON.parse(outputText);
  if (!validateQuestions(parsed.questions)) {
    throw new Error("La IA ha devuelto preguntas con un formato incorrecto.");
  }
  return parsed.questions;
}

export default async function handler(request) {
  if (request.method !== "GET") return json({ error: "Método no permitido." }, 405);

  const params = new URL(request.url).searchParams;
  const stage = params.get("stage") || "";
  const course = params.get("course") || "";
  const topic = params.get("topic") || "";

  if (!CURRICULUM[stage]?.[course]?.includes(topic)) {
    return json({ error: "La etapa, el curso o el tema no son válidos." }, 400);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json({ error: "Falta configurar OPENAI_API_KEY en las variables de entorno de Netlify." }, 503);
  }

  const parts = madridDateParts();
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const id = slug(`${stage}|${course}|${topic}`);
  const cacheKey = `questions/${date}/${id}`;
  const store = getStore("promathsy-daily-questions");

  try {
    const cached = await store.get(cacheKey, { type: "json" });
    if (cached?.questions?.length === 5) {
      return json({ questions: cached.questions, date, dateLabel: dateLabel(date), source: "daily-cache" });
    }

    // Evita llamadas duplicadas simultáneas para el mismo tema y día.
    const lockKey = `locks/${date}/${id}`;
    let lockResult = await store.setJSON(lockKey, { createdAt: Date.now() }, { onlyIfNew: true });
    if (!lockResult.modified) {
      const oldLock = await store.get(lockKey, { type: "json" });
      if (oldLock?.createdAt && Date.now() - oldLock.createdAt > 120000) {
        await store.delete(lockKey);
        lockResult = await store.setJSON(lockKey, { createdAt: Date.now() }, { onlyIfNew: true });
      }
    }
    if (!lockResult.modified) {
      for (let attempt = 0; attempt < 18; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const ready = await store.get(cacheKey, { type: "json" });
        if (ready?.questions?.length === 5) {
          return json({ questions: ready.questions, date, dateLabel: dateLabel(date), source: "daily-cache" });
        }
      }
      return json({ error: "Estamos preparando este test. Pulsa volver a intentar en unos segundos." }, 503);
    }

    try {
      const yesterday = previousDate(date);
      const previous = await store.get(`questions/${yesterday}/${id}`, { type: "json" });
      const questions = await generateQuestions({
        apiKey,
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        stage, course, topic, date, previous
      });
      const value = { questions, createdAt: new Date().toISOString(), stage, course, topic, date };
      await store.setJSON(cacheKey, value);
      return json({ questions, date, dateLabel: dateLabel(date), source: "ai-generated" });
    } finally {
      await store.delete(lockKey).catch(() => {});
    }
  } catch (error) {
    console.error("Daily question generation failed:", error);
    return json({ error: "No se han podido generar las preguntas de hoy. Inténtalo de nuevo." }, 502);
  }
}
