# AguiVision

App para subir video de partidos, generar highlights por jugador y transmitir
en vivo — piloto con los equipos **U11** y **U14** (U9 y U12 ya están en la
base de datos, inactivos, listos para prender cuando toque).

## Qué es funcional ya mismo

- La app corre y se navega de verdad (Next.js real, no un mockup).
- **Invitar gente sin SQL**: pantalla "Equipo" — el entrenador escribe un
  email y elige el rol (entrenador, asistente, jugador, madre/padre), y esa
  persona queda vinculada sola la primera vez que inicia sesión.
- **Transmisión en vivo real**: el entrenador crea la transmisión desde
  "Transmitir en vivo" (botón en Inicio), la app le muestra el Server URL y
  la Stream Key para pegar en la cámara o en una app como Larix
  Broadcaster, y en cuanto la cámara empieza a mandar señal, la
  transmisión aparece sola en "En vivo" para todo el equipo — sin que
  nadie tenga que avisar nada a mano. Soporta varias transmisiones
  simultáneas (de distintos equipos) sin conflicto. Cuando la
  transmisión termina, la grabación queda guardada sola como un partido
  más en "Inicio" — se puede ver y marcar highlights ahí, igual que un
  video subido a mano.
- **Calendario por equipo**: el entrenador carga partidos, entrenamientos,
  torneos u otros eventos (con logo del rival opcional para los partidos),
  navegable mes a mes. Los próximos 3 partidos aparecen también como vista
  previa en Inicio, con el mismo estilo de tarjeta que usan otras apps de
  ligas (hora grande, escudos, fecha, lugar).
- **Notificaciones por correo**: cuando se crea un highlight, se avisa a la
  madre/padre o jugador vinculado a ESE jugador puntual (no a todo el
  equipo). Cuando se crea un evento en el calendario, se avisa a todo el
  equipo (menos a quien lo creó). Usa el mismo Resend ya conectado.
- **Login real con enlace mágico** (sin contraseñas) usando Supabase Auth.
- **Los equipos que ves dependen de tu membresía real** — la tabla
  `team_members` decide qué equipos aparecen en tu selector y con qué rol
  (entrenador, asistente, jugador, madre/padre). Nadie ve equipos donde no
  está vinculado — esto lo refuerza tanto el código como las políticas de
  seguridad (RLS) de la base de datos.
- Sin Supabase configurado, la app sigue funcionando en **modo demo**: sin
  login, con Sub-11 y Sub-14 como si fueras entrenador — así la podés ver
  andar sin crear ninguna cuenta todavía.
- **"En vivo" ya soporta transmisiones simultáneas**: la lista muestra todas
  las que estén activas (de tus equipos) y cada una se ve por separado en
  `/en-vivo/[id]`.
- El formulario de "Subir video" pega contra un endpoint real que valida
  sesión y permisos antes de crear el partido.

## Qué falta para que sea 100% real

1. **Crear el proyecto en Supabase** y correr `supabase/schema.sql` en el
   SQL Editor. Eso crea las tablas, las políticas de seguridad, el trigger
   que crea tu perfil al registrarte, y Sub-11/Sub-14 como equipos activos.
2. **Habilitar el login por enlace mágico** — en Supabase, Authentication →
   Providers, confirmá que "Email" esté activo (viene activo por defecto).
   En Authentication → URL Configuration, agregá la URL de tu app (la de
   Vercel o `http://localhost:3000` para probar local) como Site URL.
3. **Configurar las variables de entorno** — copiá `.env.local.example` a
   `.env.local` y completá con los datos de tu proyecto de Supabase.
4. **Invitarte a vos mismo como el primer entrenador** — como todavía no
   hay nadie en el equipo, hace falta un insert manual UNA sola vez (para
   todos los que se sumen después, se usa la pantalla "Equipo" dentro de la
   app, sin SQL). En Supabase SQL Editor:

   ```sql
   insert into team_invitations (team_id, email, role)
   select id, 'tu-email@ejemplo.com', 'coach' from teams where slug in ('u11', 'u14');
   ```

   Después entrá a la app con ese mismo email (poniendo tu nombre real en
   el login) — vas a quedar vinculado como entrenador de Sub-11 y Sub-14
   automáticamente. De ahí en más, para sumar a otro entrenador, un padre o
   un jugador: pantalla **Equipo** → escribís su email y elegís el rol → se
   vincula solo la primera vez que esa persona inicia sesión.
5. **Conectar el proveedor de video (Mux)**:
   - Creá una cuenta en mux.com y generá un token: Settings → API Access
     Tokens → "Generate new token" (con permiso de Mux Video).
   - En Vercel, agregá `MUX_TOKEN_ID` y `MUX_TOKEN_SECRET` como variables de
     tipo **Secret** (nunca `NEXT_PUBLIC_`, son privadas).
   - Agregá también `NEXT_PUBLIC_SUPABASE_URL` otra vez pero ahora como base
     para `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API →
     pestaña "Legacy API Keys" o la sección de service role) — también como
     **Secret**. Esta es la que usa el webhook para escribir en la base de
     datos sin depender de una sesión de usuario.
   - En Mux Dashboard → Settings → Webhooks → "Add new endpoint": la URL es
     `https://tu-app.vercel.app/api/mux/webhook`. Mux te da un "Signing
     secret" ahí mismo — pegalo en `MUX_WEBHOOK_SECRET` (también Secret).
   - Redeploy. A partir de acá, subir un video en la app manda el archivo
     real a Mux, y cuando termina de procesarlo el partido pasa solo a
     "Analizado" con el video listo para ver.

6. **Habilitar los highlights por jugada** — en Supabase SQL Editor, corré
   este bloque una vez (ya está en `schema.sql`, pero como vos corriste una
   versión anterior, hace falta agregarlo a mano):

   ```sql
   create policy "entrenadores crean highlights de su equipo" on highlights for insert
     with check (match_id in (
       select m.id from matches m
       join team_members tm on tm.team_id = m.team_id
       where tm.profile_id = auth.uid() and tm.role in ('coach', 'assistant')
     ));

   create policy "entrenadores gestionan jugadores de su equipo" on players for all
     using (team_id in (select team_id from team_members where profile_id = auth.uid() and role in ('coach', 'assistant')));
   ```

   Con esto, en la página de cada partido con video listo aparece un
   formulario "Marcar highlight": jugador, etiqueta libre (gol, asistencia,
   jugada ofensiva, jugada defensiva, lo que necesites) y el rango de
   tiempo — Mux corta ese pedazo como un clip propio.

6. **Política de almacenamiento** — decidida junto con el usuario: los
   highlights se guardan indefinidamente (casi no pesan en el costo de
   Mux), pero el video completo de un partido se borra automáticamente a
   los 6 meses (`app/api/cron/cleanup-old-matches`, corre una vez por día
   vía `vercel.json`). El partido en sí no desaparece de la app — solo
   pierde el video, y sus highlights ya generados siguen intactos.
   Para protegerlo de llamadas externas, agregá en Vercel:
   - Key: `CRON_SECRET` — Value: cualquier texto largo al azar (por
     ejemplo, generado en https://1password.com/password-generator).

## Instalación local

```bash
npm install
cp .env.local.example .env.local   # completar con tus claves de Supabase
npm run dev
```

Abrí http://localhost:3000 — sin Supabase configurado entra directo en modo
demo; con Supabase configurado te pide iniciar sesión.

## Estructura

```
middleware.ts                → protege las rutas: sin sesión, redirige a /login
                                (se desactiva solo en modo demo, sin Supabase)
app/login/                   → login con enlace mágico
app/auth/callback/           → recibe el enlace mágico y crea la sesión
app/[teamSlug]/               → Inicio, Subir, Highlights (por equipo)
app/en-vivo/                  → lista de transmisiones simultáneas
app/en-vivo/[streamId]/       → ver una transmisión puntual
app/api/upload/                → pide la subida directa a Mux y crea el partido
app/api/mux/webhook/            → Mux avisa acá cuando el video está listo
app/[teamSlug]/partidos/[matchId]/ → ver el video de un partido puntual
lib/mux.ts                      → cliente de Mux (server-only)
lib/supabase/admin.ts           → cliente con permisos totales, solo para el webhook
lib/supabase/client.ts        → cliente de Supabase para componentes de cliente
lib/supabase/server.ts        → cliente de Supabase para Server Components
lib/data.ts                    → toda la lectura de datos (equipos según tu
                                 membresía real, con datos de ejemplo de
                                 respaldo en modo demo)
supabase/schema.sql            → el modelo de datos completo + políticas de
                                  seguridad (RLS) + trigger de perfil
```
