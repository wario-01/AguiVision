# AguiVision — Roadmap

Última actualización: 8 de octubre de 2026.

## Hecho
- Evaluación del jugador: formativa (todos los equipos) y físico-técnica (U14), con perfil unificado y PDF.
- Datos del jugador: número, posición, peso, altura y perfil (pie dominante).
- Mover un partido/video a otro equipo.
- Alta, edición y baja de jugadores desde la app.
- Recuperar un video que quedó en Mux sin partido (Subir → Recuperarlo desde Mux).
- Niños que juegan en 2 equipos: se vinculan desde "Editar datos" y los papás ven los highlights de las dos categorías juntos.
- Compartir un highlight con todo el equipo (interruptor del entrenador en el highlight; los papás lo ven con la marca "Compartido").
- Descargar el partido completo (botón en la página del partido, solo entrenador/asistente) y limpieza de partidos "fantasma" (sin video ni highlights) a los 6 meses.
- Sub-12 con evaluación físico-técnica (mismas 5 pruebas que Sub-14).
- Botón "Standings" en Inicio de cada equipo, con el enlace de la liga que el cuerpo técnico puede cambiar (Equipo → Tabla de posiciones).
- IMC con historial en el perfil del jugador (peso en libras, altura en pies/pulgadas). Cada cambio de peso o altura guarda una medición. La familia ve el de su hijo (menú Crecimiento), con gráfica de percentiles del CDC. No se guarda fecha de nacimiento (solo la edad al medir). El aviso "conviene hablar con el pediatra" combina el IMC, la relación cintura/altura (0.5) y la tendencia: un IMC alto con cintura en rango se muestra como informativo (probable músculo), sin aviso.
- Pendiente opcional del IMC: interruptor por jugador para apagar el aviso de Inicio.
- Borrar un ciclo de evaluación (botón al final de la página del ciclo, solo entrenador) y borrar un resultado físico-técnico del historial.
- Asistencia: se toma desde el Calendario (botón "Tomar asistencia" en cada evento: presente, tarde, ausente, justificado). Reporte del equipo por año y mes con % de entrenamientos, juegos y total, descarga en Excel (resumen y detalle por evento), historial anual, ficha del jugador y vista para la familia de su propio jugador. "Justificado" no baja el porcentaje.
- Primera ronda de endurecimiento de seguridad (ver abajo).

## Siguiente: producto
0. **Reunión ejecutiva (8 oct 2026)** — puntos que salieron, en orden de dificultad:
   - **Recibos de pago automatizados** (en espera, decidido 8 oct): generar el recibo desde la app. Pendiente definir qué se cobra (inscripción, mensualidad, torneos), quién registra el pago y si el recibo se envía por correo (Resend) o se descarga como PDF.
   - **IA para análisis de video** (costos investigados 8 oct 2026). Ruta más barata, en 3 pasos:
     1. Ficha de jugador con estadísticas sacadas de las etiquetas de los highlights (goles, asistencias, atajadas): costo $0, sin IA.
     2. "Reel" de reclutamiento: página compartible que reproduce seguidos los highlights del jugador: costo ~$0 (usa los clips que ya existen).
     3. IA (Gemini 3.1 Flash-Lite, plan de pago): proponer momentos del partido completo y describir los clips de cada jugador. ~$0.07–0.14 por partido de 70 min, ~$1–10 al mes con 4 equipos. Probar primero con 2–3 partidos para medir qué tan bien funciona con cámara panorámica.
     Opcional: bajar el reel como un solo MP4 con Shotstack (~$0.20–0.40 por video de 2 min). Revisar los términos de Google (API de 18+ y menores) antes de activar la IA.
   - **Standings como tabla propia** (opcional, más difícil): hoy es un botón que abre la liga; importar los datos a una tabla dentro de la app depende de que la liga permita leerlos.
1. **Pasar jugadores de un equipo a otro** (cuando suben de categoría). Decisiones ya tomadas (5 oct 2026):
   - El historial sigue al jugador: sus evaluaciones y mediciones físicas viajan con él al equipo nuevo, mostrando
     de qué ciclo y equipo son. Nada se copia ni se borra.
   - El entrenador nuevo ve el historial completo, pero solo a partir del momento en que se hace el cambio de equipo
     (no antes). El papá y el jugador también lo ven.
   - Datos del jugador (número, posición, peso, altura, perfil, foto) se conservan.
   - Los partidos, videos y ciclos de evaluación se quedan en el equipo viejo (son del equipo). Los highlights del
     jugador los sigue viendo su papá en la vista unificada.
   - Requiere cuidado con los permisos (RLS): hoy las evaluaciones se ven por equipo del jugador. Hacerlo con SQL
     primero, aditivo, sin perder datos, y probar paso a paso. Revisar antes que Supabase tenga respaldos activos (punto 6).
   (Los niños que juegan en 2 equipos a la vez ya se pueden vincular; esto es el caso de cambio de categoría.)
2. **Cierre de temporada**: archivar equipo o temporada sin perder el historial de evaluaciones.
3. **Evaluación por tendencia**: en el perfil, comparar el último ciclo con el anterior (sube/baja por área).
4. **PDF para papás**: que cada papá/jugador vea el perfil de su propio hijo y reciba el PDF por correo (Resend).
5. **Reenviar invitaciones** (opcional; hoy se cancela y se vuelve a invitar).
6. **Respaldo de la base de datos**: confirmar que Supabase tiene copias automáticas activas.
7. Si los videos se siguen subiendo al equipo equivocado: revisar cómo se elige el equipo al iniciar una transmisión.

## Backlog de seguridad (pendiente)
Lo que queda de la auditoría de octubre 2026, de menor a mayor esfuerzo.

**Media**
- Las fotos están en un bucket público (los nombres no se pueden adivinar, pero quien reciba el enlace lo conserva).
  Solución a futuro: bucket privado con enlaces firmados.
- Las transmisiones públicas no tienen límite de visitas ni validación (cualquiera con el enlace ve la
  transmisión; cada visita escribe una fila).
- El truco de "rastreadores" (WhatsApp/Facebook) en el middleware se puede falsificar; el impacto hoy es bajo.

**Baja**
- La política de actualización de `profiles` permite cambiar el propio correo (afecta a qué correo llegan
  los avisos). Arreglarlo con cuidado para no romper la foto de perfil.
- `cors_origin: "*"` en las subidas a Mux si falta `NEXT_PUBLIC_APP_URL`.
- Revisar de vez en cuando las políticas de la base de datos al agregar tablas nuevas (siempre RLS activado).

## Ya corregido en la ronda de octubre 2026
- Un papá o jugador ya no puede borrar videos/clips ni terminar transmisiones (el rol se verifica antes de tocar Mux).
- Las evaluaciones y el perfil del jugador son solo para entrenador/asistente (páginas y base de datos).
- `live_stream_views` ahora tiene RLS activado.
- El inicio de sesión ya no acepta redirecciones a otros sitios.
- Un ciclo de evaluación solo se abre desde su propio equipo.
- El webhook de Mux rechaza eventos sin firma cuando la clave está configurada.
- Peso, altura y perfil de los jugadores viven en una tabla aparte (`player_private`) que solo leen entrenador/asistente.
- La llave de transmisión ya no se guarda en la base de datos.
- Los highlights se filtran por rol también en la base de datos (papás/jugadores solo ven los de su jugador).
- Papás y jugadores ya no ven los correos de los demás miembros del equipo.
- Las subidas de imágenes validan tipo (JPG/PNG/WEBP/GIF) y tamaño (5 MB); crear eventos exige ser entrenador/asistente antes de subir nada.
- Los correos de aviso escapan el texto (nombres, títulos) para evitar inyección de HTML.

## Seguridad — pendientes (ronda 3, 8 oct)
- Sin límite de intentos (rate limiting) en las APIs; requiere servicio externo (Upstash/Vercel Firewall).
- Video de menores con reproducción pública en Mux (cualquiera con el link del video); mejora: playback firmado.
- `matches/recover` acepta cualquier assetId de la cuenta Mux compartida.
- Bucket `photos` público (URLs no adivinables, pero abiertas).
- Rastreadores (user-agent) saltan el login: falsificable, las páginas igual validan membresía.
- Política de `profiles` permite editar el propio email; cors "*" como respaldo si falta NEXT_PUBLIC_APP_URL.
- Plan gratuito de Supabase se pausa tras una semana sin uso; revisar plan antes de la temporada.
- Supabase plan gratuito: sin copias de seguridad automáticas. Hacer una exportación manual periódica (Dashboard → Database → Backups no existe en Free; usar `pg_dump` o exportar tablas a CSV) o pasar a Pro antes de la temporada.
- Opcional: interruptor "transmisión pública / solo equipo" por cada vivo.
