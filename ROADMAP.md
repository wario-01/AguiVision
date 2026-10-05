# AguiVision — Roadmap

Última actualización: 5 de octubre de 2026.

## Hecho
- Evaluación del jugador: formativa (todos los equipos) y físico-técnica (U14), con perfil unificado y PDF.
- Datos del jugador: número, posición, peso, altura y perfil (pie dominante).
- Mover un partido/video a otro equipo.
- Alta, edición y baja de jugadores desde la app.
- Recuperar un video que quedó en Mux sin partido (Subir → Recuperarlo desde Mux).
- Primera ronda de endurecimiento de seguridad (ver abajo).

## Siguiente: producto
1. **Pasar jugadores de un equipo a otro** (cuando suben de categoría), conservando su historial.
2. **Cierre de temporada**: archivar equipo o temporada sin perder el historial de evaluaciones.
3. **Evaluación por tendencia**: en el perfil, comparar el último ciclo con el anterior (sube/baja por área).
4. **PDF para papás**: que cada papá/jugador vea el perfil de su propio hijo y reciba el PDF por correo (Resend).
5. **Reenviar invitaciones** (opcional; hoy se cancela y se vuelve a invitar).
6. **Respaldo de la base de datos**: confirmar que Supabase tiene copias automáticas activas.
7. Si los videos se siguen subiendo al equipo equivocado: revisar cómo se elige el equipo al iniciar una transmisión.

## Backlog de seguridad (pendiente de la auditoría de octubre 2026)
Ordenado por prioridad. Lo marcado con [config] depende de variables de entorno en Vercel.

**Alta**
- Papás y jugadores todavía pueden leer `peso`, `altura` y `perfil` de TODOS los jugadores de su equipo
  directamente contra la base de datos (la tabla `players` es legible por cualquier miembro). Solución:
  mover esos campos a una tabla solo para entrenadores, o exponer una vista sin ellos.
- La llave de transmisión (`live_streams.stream_key`) es legible por cualquier miembro del equipo.
  Solución: moverla a una tabla solo para entrenadores.
- [config] `MUX_WEBHOOK_SECRET`: confirmar que está configurada en Vercel. Con ella, el webhook ya rechaza
  eventos sin firma; sin ella, no se puede verificar nada.
- [config] `CRON_SECRET`: confirmar que está configurada. Si no, la ruta de limpieza queda abierta.

**Media**
- Los highlights se filtran por rol solo en el código; en la base de datos cualquier miembro puede leerlos todos.
- Papás y jugadores ven correos y vínculos de otros miembros en la pantalla Equipo.
- Subidas de archivos (foto de rival, fotos de perfil/jugador, logos): validar tipo y tamaño, y exigir rol
  de entrenador antes de subir el logo del rival.
- Las fotos están en un bucket público (los nombres no se pueden adivinar, pero quien reciba el enlace lo conserva).
- El truco de "rastreadores" (WhatsApp/Facebook) en el middleware se puede falsificar; el impacto hoy es bajo.
- Las transmisiones públicas no tienen límite de visitas ni validación.

**Baja**
- Escapar HTML en los correos de notificación (nombres, títulos).
- La política de actualización de `profiles` permite cambiar el propio correo.
- `cors_origin: "*"` en las subidas a Mux si falta `NEXT_PUBLIC_APP_URL`.

## Ya corregido en la ronda de octubre 2026
- Un papá o jugador ya no puede borrar videos/clips ni terminar transmisiones (el rol se verifica antes de tocar Mux).
- Las evaluaciones y el perfil del jugador son solo para entrenador/asistente (páginas y base de datos).
- `live_stream_views` ahora tiene RLS activado.
- El inicio de sesión ya no acepta redirecciones a otros sitios.
- Un ciclo de evaluación solo se abre desde su propio equipo.
- El webhook de Mux rechaza eventos sin firma cuando la clave está configurada.
