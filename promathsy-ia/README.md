# Promathsy IA — preguntas nuevas cada día

Este proyecto sustituye el banco fijo de preguntas del HTML por preguntas generadas mediante OpenAI API.

## Cómo funciona

- El alumno elige etapa, curso y tema.
- El navegador llama a `/.netlify/functions/daily-questions`.
- La función genera 5 preguntas nuevas para esa combinación usando la IA.
- Las guarda en Netlify Blobs con la fecha de `Europe/Madrid`.
- Todos los alumnos que abran ese mismo tema durante ese día reciben el mismo conjunto guardado.
- A las 00:00 de España peninsular cambia la jornada. El primer alumno que entre en cada tema hace que se genere el conjunto nuevo de ese día.
- Las preguntas anteriores se consultan para pedir a la IA que no las repita.

La función programada se ejecuta a las 22:00 y 23:00 UTC y comprueba cuál de esas ejecuciones coincide con las 00:00 de `Europe/Madrid` (por el horario de verano/invierno).

## Configuración necesaria

1. Sube **toda esta carpeta**, no solo `index.html`, a un repositorio de GitHub.
2. En Netlify, importa ese repositorio como un sitio nuevo o sustituye el proyecto actual manteniendo una copia de seguridad.
3. En Netlify abre **Site configuration → Environment variables** y añade `OPENAI_API_KEY` con una clave de la plataforma API de OpenAI.
4. Opcionalmente añade `OPENAI_MODEL`. Si no lo haces, se utiliza `gpt-4o-mini`.
5. Vuelve a desplegar el sitio.
6. En Netlify, abre **Functions** y comprueba que aparecen `daily-questions` y `rotate-daily`. La segunda debe mostrar la etiqueta Scheduled.

## Importante sobre la clave y el coste

- No pongas la clave de OpenAI dentro de `index.html`, ni la compartas en el navegador.
- La clave se guarda como variable privada en Netlify.
- La API de OpenAI se factura separadamente de una suscripción de ChatGPT; revisa la facturación y los límites de gasto de la plataforma API.
- Netlify Blobs conserva el conjunto del día para no volver a pagar por generar las mismas preguntas para cada alumno.

## Prueba

Después de desplegar y configurar la clave, abre un tema de matemáticas y pulsa **Empezar ejercicios**. En local, abre el proyecto con Netlify Dev (`npm install`, `npx netlify dev`) en vez de abrir el HTML con doble clic, ya que las funciones del servidor no existen en un archivo local estático.
