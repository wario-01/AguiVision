# AguiVision 

App para subir video de partidos, generar highlights por jugador y transmitir
en vivo — piloto con los equipos **U11** y **U14** (U9 y U12 ya están en la
base de datos, inactivos, listos para prender cuando toque).

## Qué es funcional ya mismo

- La app corre y se navega de verdad (Next.js real, no un mockup).
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
4. **Vincularte como entrenador** — entrá a la app, iniciá sesión con tu
   email (te va a redirigir a `/en-vivo` porque todavía no estás en ningún
   equipo), y en Supabase SQL Editor corré el bloque "VINCULAR AL PRIMER
   ENTRENADOR" que está comentado al final de `schema.sql`, con tu email.
   Recargá la app — ya deberías ver Sub-11 y Sub-14 en el selector.
5. **Conectar el proveedor de video** (Mux o Cloudflare Stream). Los puntos
   exactos donde se conecta están marcados con `TODO` en
   `app/api/upload/route.ts`.

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
app/api/upload/                → endpoint que recibe la subida de video
lib/supabase/client.ts        → cliente de Supabase para componentes de cliente
lib/supabase/server.ts        → cliente de Supabase para Server Components
lib/data.ts                    → toda la lectura de datos (equipos según tu
                                 membresía real, con datos de ejemplo de
                                 respaldo en modo demo)
supabase/schema.sql            → el modelo de datos completo + políticas de
                                  seguridad (RLS) + trigger de perfil
```
