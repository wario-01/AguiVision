# AguiVision — Roadmap

Última actualización: 4 de noviembre de 2026 (último paquete subido: 55; en curso: 56 cuota acordada).

## Hecho
- Evaluación del jugador: formativa (todos los equipos) y físico-técnica (U12 y U14), con perfil unificado y PDF. Ver sección "Evaluaciones" abajo para lo de octubre 2026.
- Datos del jugador: número, posición, peso, altura y perfil (pie dominante).
- Mover un partido/video a otro equipo.
- Alta, edición y baja de jugadores desde la app.
- Recuperar un video que quedó en Mux sin partido (Subir → Recuperarlo desde Mux).
- Niños que juegan en 2 equipos: se vinculan desde "Editar datos" y los papás ven los highlights de las dos categorías juntos.
- Compartir un highlight con todo el equipo (interruptor del entrenador en el highlight; los papás lo ven con la marca "Compartido").
- Descargar el partido completo (botón en la página del partido, solo entrenador/asistente) y limpieza de partidos "fantasma" (sin video ni highlights) a los 6 meses.
- Sub-12 con evaluación físico-técnica (mismas pruebas que Sub-14; desde oct 2026 son 6 pruebas en sistema inglés, ver "Evaluaciones").
- Botón "Standings" en Inicio de cada equipo, con el enlace de la liga que el cuerpo técnico puede cambiar (Equipo → Tabla de posiciones).
- IMC con historial en el perfil del jugador (peso en libras, altura en pies/pulgadas). Cada cambio de peso o altura guarda una medición. La familia ve el de su hijo (menú Crecimiento), con gráfica de percentiles del CDC. No se guarda fecha de nacimiento (solo la edad al medir). El aviso "conviene hablar con el pediatra" combina el IMC, la relación cintura/altura (0.5) y la tendencia: un IMC alto con cintura en rango se muestra como informativo (probable músculo), sin aviso.
- Pendiente opcional del IMC: interruptor por jugador para apagar el aviso de Inicio.
- Borrar un ciclo de evaluación (botón al final de la página del ciclo, solo entrenador) y borrar un resultado físico-técnico del historial.
- Asistencia: se toma desde el Calendario (botón "Tomar asistencia" en cada evento: presente, tarde, ausente, justificado). Reporte del equipo por año y mes con % de entrenamientos, juegos y total, descarga en Excel (resumen y detalle por evento), historial anual, ficha del jugador y vista para la familia de su propio jugador. "Justificado" no baja el porcentaje.
- Primera ronda de endurecimiento de seguridad (ver abajo).
- Galería de fotos en Cloudflare R2, rol Colaborador y permiso de fotos por familia (ver "Fotos").
- Sistema de recibos del club con reportes, exentos y pagos anteriores (ver "Recibos").
- Logo nuevo de Nido Austin, resaltado en color crema y rediseño de octubre 2026 (ver "Diseño").
- Mejoras de transmisiones en vivo (ver "Transmisiones").
- Ficha técnica del jugador estilo tarjeta, imprimible (ver "Evaluaciones").
- Colores y fuentes oficiales de la guía de marca Club América Nido Águila USA (azul #003C71, amarillo #F9E547, rojo #E03C31 con moderación; títulos Avant Garde Bold, texto Montserrat). Ver "Diseño".
- Calendario (30 oct 2026): torneos con varios juegos adentro (rival, día, hora; se agregan también al editar) y eventos que se repiten (días de la semana hasta una fecha; se borra solo uno o toda la serie). SQL: `supabase/calendario-torneos-repeticion.sql`.
- Videos en la galería de fotos (30 oct 2026): hasta 5 por vez de 600 MB, se pueden marcar como highlight (se envían a Mux, máximo 5 minutos). SQL: `supabase/fotos-4-videos.sql`.

- Detalle de evento y eventos cancelados (31 oct 2026): al tocar un evento en Inicio o en el calendario se abre su detalle; un evento se puede marcar CANCELADO (queda en el calendario sin asistencia, con motivo). SQL: `supabase/calendario-cancelado.sql`.
- Perfil del equipo (1 nov 2026, solo entrenadores): pestaña en Equipo con resumen, campograma con alineación (formaciones 11/9/7, suplentes, no convocados), hoja imprimible con logo, captura manual de estadísticas del partido (marcador, tiros, esquinas, faltas, cambios y por jugador: minutos, goles, asistencias, amarillas, rojas, atajadas) y tabla de la temporada. SQL: `supabase/alineaciones-estadisticas.sql`. Formación por defecto según categoría: U9 = 7v7, U11/U12 = 9v9, U14 = 11v11 (confirmar con Mario). Cambios planeados sin límite y con reingreso (minuto opcional): lista en orden con "sale/entra"; se ven en el campo y en la hoja impresa. SQL: `supabase/alineaciones-cambios.sql`.

- Jornadas y highlight al subir (3 nov 2026): cada partido puede llevar número de jornada (se ordena J1, J2…) y se puede editar rival, jornada y fecha; al subir videos a la galería se pueden marcar como highlight (etiqueta y jugador) y se crean solos. SQL: `supabase/partidos-jornada.sql`.

- Pantalla del partido y recibo (4 nov 2026): en computadora grande, «Marcar highlight» va a la derecha del video (ya no hay que bajar y subir), con botones «Usar el del video» para tomar el segundo actual; los datos del partido, borrar y mover quedan debajo. El recibo se imprime con tamaño fijo (5 in de ancho) para que quepa en una sola hoja en cualquier papel.

## Siguiente: producto
0. **Reunión ejecutiva (8 oct 2026)** — puntos que salieron, en orden de dificultad:
   - **Recibos de pago**: ya construidos (ver "Recibos"). Falta el envío por correo.
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
3. ~~Evaluación por tendencia~~ — hecho en oct 2026: radar con el ciclo anterior, cambio por área y comparación de pruebas físicas (ver "Evaluaciones").
4. **PDF para papás por correo**: las familias ya ven la evaluación de su hijo, el radar y la ficha técnica (imprimible) cuando el entrenador publica. Falta que reciban el PDF por correo (Resend).
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
- Las evaluaciones y el perfil del jugador son solo para entrenador/asistente (páginas y base de datos). Excepción desde oct 2026: la familia ve la evaluación de SU hijo solo cuando el entrenador la publica (`supabase/evaluaciones-familias.sql`).
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

## Fotos (oct 2026)
- Fotos en Cloudflare R2 (privado, URLs firmadas). Tablas/políticas: `supabase/fotos-1-rol.sql` y `fotos-2-tablas.sql`.
- Rol nuevo `collaborator`: sube y ve fotos, nada más.
- Se borran solas a los 60 días (cron `cleanup-fotos`) salvo las marcadas "Guardar".
- Pendiente: copia automática R2 → Buffalo (rclone, solo copiar, nunca espejo) al menos cada semana, para que la Buffalo conserve lo que la app borra.
- Pendiente: galería para familias (decidir si ven todo o solo a su hijo).

## Recibos (oct 2026)
- Acceso a nivel club (`finance_access`): owner (Mario), admin (solo reportes), issuer (expide + reportes). Se administra en /recibos/accesos.
- Recibos con número consecutivo (`receipts_number_seq`; para empezar en otro número: `alter sequence receipts_number_seq restart with 700;`). No se borran, se anulan.
- Saldo: en Anualidad y Membresía se descuentan los pagos anteriores de la misma temporada (junio–mayo).
- Pendiente: recibo en español/inglés.
- **Pendiente (decidido 27 oct 2026, en espera de que termine la configuración de la página web y del dominio): enviar el recibo por correo a la familia.** Hoy el recibo solo se ve, se imprime o se guarda como PDF desde la app; el correo que aparece en los datos es el de quien lo expide, no el de la familia. Propuesta:
  - Campo opcional "Correo de quien paga" en el formulario del recibo, con casilla "Enviar copia por correo".
  - Correo corto de Nido Austin (Resend, que ya usa la app) con número de recibo, jugador, monto y motivo, y botón para verlo; opcionalmente el PDF adjunto y copia a quien lo expidió.
  - Botón "Enviar por correo" en cada recibo ya creado, para reenviarlo o corregir la dirección.
  - Recibos anulados: el correo dice "ANULADO" o no se envía.
  - Decisión pendiente: guardar o no el correo en el recibo (recomendado guardarlo, como historial; solo lo ven quienes tienen acceso a finanzas).
  - Antes de activarlo: verificar el dominio del club en Resend (SPF/DKIM) para que no caiga en spam.
- Exentos (por ejemplo, hijos de entrenadores): se marcan en Recibos → Pagos anteriores; salen como “Exento” y no cuentan como saldo pendiente. Tabla `finance_exemptions`.

## Evaluaciones (oct 2026)
- **U14** se evalúa por competencias (documento del prof. Mario Dena): áreas Táctico-técnico-cognitiva, Condicional motriz y Criterios transversales (incluye lateralidad eficaz), con la escala de 5 niveles. U12 y menores siguen con Táctico, Técnico, Físico y Actitudinal.
- Ciclos de **duración libre**: mensual, bimestral, trimestral, cuatrimestral, semestral, anual o personalizado; el fin se sugiere solo y se puede cambiar. Las competencias de U14 se precargan del ciclo anterior (o de la plantilla) y son editables al crear el ciclo y después ("Editar competencias de este ciclo"; quitar una competencia borra sus calificaciones).
- **Pruebas físicas (U12 y U14)**, sistema inglés: Wells (pulgadas), Course Navette (yardas recorridas), salto horizontal (pulgadas), balón medicinal sobre la cabeza (pies), sprint 20 yardas (segundos), agilidad / cambios de dirección (segundos). Las métricas anteriores se borraron. SQL: `supabase/evaluaciones-u14.sql`.
- **Comparación con el propio avance**: radar con línea punteada del ciclo anterior y cambio por área; pruebas físicas última vs anterior (▲/▼) y "Última vez" al capturar.
- **Familias**: ven radar, ficha técnica y evaluación de su hijo cuando el entrenador publica.
- **Ficha técnica** (tarjeta dorada con rayos, colores del club): datos de 40 a 99 (VEL, RES, POT, FLX, TAC, ACT; en equipos sin pruebas físicas salen de las áreas y la asistencia). La escala de cada prueba (qué resultado vale 40 y cuál 99) se edita en Evaluación físico-técnica → "Escala de la ficha técnica". Los valores iniciales son estimaciones: ajustarlos tras la primera ronda de pruebas y luego dejarlos fijos para comparar siempre contra la misma referencia. Imprimible desde el perfil (staff) y desde "Evaluación" (familia, solo su hijo).
- **Portero**: se marca poniendo Posición: Portero en "Editar datos". Área "Portero" con 6 competencias de ejemplo (posicionamiento, manejo, reflejos, salidas, juego con los pies, comunicación) que se califica solo a porteros; su ficha cambia RES por ARQ y marca POR. Pendiente: definir los parámetros reales de portero.
- Pendiente: pruebas físicas y escala con datos reales del equipo; versión de la ficha para los demás equipos si se quiere.

## Transmisiones (oct 2026)
- Botón Copiar de la llave con respaldo para celulares; "N visitas" en lugar del contador falso de "viendo ahora".
- Miniaturas en la lista En vivo, botón Compartir (menú del celular) y Copiar enlace, pantalla de espera que se actualiza sola, recuadro "Antes de empezar" y textos en "tú".
- Pendiente: "Próximas transmisiones" desde el calendario, indicador de que la señal ya llega, título automático desde el calendario, aviso "Ver el partido completo" al terminar.

## Diseño (oct 2026)
- Ficha técnica estilo FIFA en colores oficiales, con efecto holográfico (se inclina y brilla con el dedo/mouse, la inclinación del teléfono o el scroll; archivo `components/PlayerCard.tsx`).
- Login con logo grande, franjas del club y lema "Grandes de corazón" (fuente Avant Garde Bold de la guía de marca Nido USA).
- Inicio con tarjeta "Siguiente", "Último partido" y highlights más grandes; menú del celular con 4 accesos y "Más"; color de acento por equipo (U9 verde, U11 azul claro, U12 rojo, U14 naranja); aros con número en las fotos de jugadores.
- Reportes con barras de avance (recibos) y semáforo de asistencia.
- Pendiente: marcador manual del partido (dos números, solo cuerpo técnico) para mostrarlo en "Último partido" — pospuesto por ahora.

## Ideas / pendientes grandes
- **Editor de highlights (dibujos + voz + música)**: el video no se modifica; los dibujos se guardan con segundo de aparición y duración y se pintan encima al reproducir. **Etapa 1 (dibujos) hecha en paquete 50**: flecha, cuadro, círculo, texto y trazo; arrastrar o tocar inicio/fin; puntos ajustables; pausa automática 2/3/5 s; botón "Probar con pausas"; funciona en computadora y teléfono (requiere SQL `highlights-dibujos.sql`). **Etapa 2 (voz + pantalla completa) hecha en paquete 51** (requiere SQL `highlights-voz.sql`): graba con el micrófono mientras corre el video en silencio, se guarda en R2 (`voz/<equipo>/`), las familias la oyen sincronizada; con voz el video no se pausa solo; pantalla completa en el editor (modo propio para iPhone). Por probar en iPhone/Android reales: formatos de audio (webm/m4a) y desbloqueo de audio en iPhone. **Etapa 3 (música) hecha en paquete 53** (requiere SQL `highlights-musica.sql`): 6 canciones de Pixabay incluidas en la app (`public/musica/`, créditos en `CREDITOS.txt`, lista en `lib/music-library.ts`) más biblioteca del equipo (el entrenador sube MP3 libres de derechos; se guardan en R2 `musica/<equipo>/`), una canción por highlight con volumen, se repite si es corta, baja sola mientras habla la voz; el volumen usa Web Audio para que funcione en iPhone (las incluidas son del mismo sitio, así que funcionan siempre; las subidas a R2 necesitan CORS GET, si no, en iPhone sonarían al máximo). Fuentes sugeridas para más pistas: Pixabay Music (revisar licencia de cada pista). **Etapa 4 (video final, gratis en el navegador) hecha en paquete 54** (requiere SQL `highlights-video-final.sql`): botón «Crear video final» en el editor; el navegador graba en tiempo real el clip con dibujos + voz + música (canvas + MediaRecorder + Web Audio), lo sube directo a Mux y el webhook (`final:<id>`) reemplaza el clip y borra el anterior; las familias lo ven como video normal y «Descargar» baja el editado. «Volver a editar» (`/api/highlights/reedit`) vuelve a sacar el clip limpio del partido (o de la galería) y devuelve las capas guardadas. Límites: el video completo del partido se borra a los 6 meses (cron `cleanup-old-matches`) y los videos de la galería a los 60 días, después de eso ya no se puede volver a editar (el video final sigue). Requiere CORS de lectura (GET) en R2 para voz/música subidas y que stream.mux.com permita leer el mp4 (por probar en producción). Por probar en iPhone/Android reales (MediaRecorder). Alternativa de pago si falla en teléfonos: servicio externo (~$0.20–0.40 por video de 2 min).
- **Automatizar la captura de estadísticas del partido (pendiente, acordado 1 nov 2026)**: hoy el entrenador pasa a mano los datos de la hoja impresa. Siguiente etapa: tomar una foto de la hoja llena y que un modelo con visión (API de Anthropic, modelo pequeño tipo Haiku) lea los cuadros escritos a mano; la app muestra lo leído para corregir y confirmar, y luego guarda en `game_stats` / `game_results`. La hoja ya trae código del partido y un cuadro fijo por dato para facilitar la lectura. Costo estimado: medio centavo a unos pocos centavos por hoja (verificar precios vigentes); requiere crear una llave de API (cuenta aparte de la suscripción) en Vercel con límite de gasto mensual. Alternativa gratis ya disponible: captura manual en la app.
- **Perfil del equipo, mejoras posibles**: evaluación promedio, OVR de la ficha y highlights por jugador en la tabla; marcar en el campograma a los que faltaron a la última práctica; goleadores en el perfil del jugador.
- **Álbum de estampas** (fin de temporada): álbum imprimible por equipo y hojas de estampas con las fichas técnicas, cada niño recibe la misma cantidad de copias para regalar a sus compañeros (con una pregunta para conversar). Sin compartir por internet; posible QR dentro de la app en una segunda etapa. Sacar primero la ficha técnica y simular una página antes de construirlo.
- **Manuales y presentación**: actualizar el manual de entrenadores, el de familias y la presentación para padres (fotos, recibos, evaluación U14, ficha técnica, nuevo diseño); completar el contacto del club en la presentación.
- **Respaldo de fotos en la Buffalo** (rclone, solo copiar, cada semana o menos de 60 días): falta saber si hay una computadora siempre encendida.
- **Página web del club** (proyecto aparte, con la sección de AguiVision y highlights) y después mover la app a un subdominio (`app.`).
- Enviar el recibo por correo (ver "Recibos").

## Nota de traspaso: álbum de estampas (para la próxima sesión)
Decidido con Mario (todo en español, explicaciones cortas, primero simular antes de construir):
- Se imprime al final de la temporada: un álbum por equipo (U9, U11, U12, U14) y hojas de estampas. Las estampas son las fichas técnicas de los jugadores (`components/PlayerCard.tsx`, datos de `lib/ficha-shared.ts` y `lib/data-ficha.ts`).
- Dinámica: cada niño platica con cada compañero para conseguir su estampa; cada niño recibe la misma cantidad de copias para regalar. Cada estampa lleva una pregunta para conversar. No se comparten por internet; un QR dentro de la app podría ser una segunda etapa.
- Empezar por simular una página del álbum y una hoja de estampas (como se hizo con la ficha) y mostrársela a Mario antes de tocar el código.
- Para imprimir: la ficha ya es un SVG que se ve igual impresa (`.ficha-card`, ancho de 4 pulgadas en `app/globals.css`). Ojo: el holograma es solo de pantalla; al imprimir sale con los colores pero sin movimiento.
- Preguntas abiertas: tamaño de la estampa (¿varias por hoja carta?), número de copias por niño, quién imprime, qué pregunta lleva cada una, si el álbum incluye a los entrenadores.
- Forma de trabajo: Claude solo puede LEER el repo (el push está bloqueado); cada cambio se entrega como zip numerado (paquete N) que Mario sube a GitHub web, y después se verifica contra origin/main. El último paquete subido fue el 55.

## Finanzas: cuota acordada (paquete 56)
- Tabla `player_fees` (historial; la vigente es la más reciente). Solo dueño y quienes expiden recibos pueden ajustar; cada cambio lleva motivo, nombre y fecha.
- Cuota mensual × meses. Ingreso tarde: mes dividido en 4 semanas (días 1-7 = 4/4, 8-14 = 3/4, 15-21 = 2/4, 22+ = no se cobra ese mes). El total se puede ajustar a mano.
- El total del recibo de anualidad queda fijo (lo impone el servidor). Es por temporada: la siguiente vuelve a $1,320.
- Membresía: pago único, $90 en 2026-27 (`MEMBERSHIP_FEE_CENTS` en lib/finance-shared.ts; cambia solo por temporada).
