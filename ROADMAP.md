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
