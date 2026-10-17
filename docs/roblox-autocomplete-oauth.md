# Roblox: autocompletado, vinculación y foto · 3.11.2

## Qué cambia

- `/registrar-cedula`, campo `roblox`: Discord muestra hasta diez sugerencias desde tres caracteres. Ejemplo: escribir `pandasgord` puede ofrecer `Pandasgordo` si Roblox devuelve esa cuenta. Se muestra usuario, nombre visible e ID; se guarda el usuario canónico, no el nombre visible. Es una sugerencia, no prueba de propiedad.
- Búsqueda oficial `GET https://users.roblox.com/v1/users/search?keyword=...&limit=10`, sin clave ni cookie Roblox. Usa agrupación de peticiones iguales, 100 ms para agrupar escritura, resultados recientes en memoria y un presupuesto de 1,9 segundos para el proveedor. Los usuarios ya conocidos se filtran sin esperar otra consulta. La latencia y resultados nuevos dependen de Roblox y de la conexión; no se promete una coincidencia si el proveedor no la devuelve.
- Un 429 activa una pausa de 30 segundos. Se limitan las peticiones por usuario, las consultas totales y la concurrencia. Si no hay respuesta ni resultados en memoria, se devuelve una lista vacía y se permite escribir el usuario manualmente. Las plantillas de `/enviar-mensaje` mantienen su permiso administrativo.
- La cédula solicita `avatar-headshot`, 420 × 420, mediante el ID vinculado o el usuario declarado. Ignora fotos genéricas de OAuth que podrían mostrar el cuerpo. El recorte permanece centrado. Si no se obtiene una cabeza válida, conserva la silueta.
- Cookie API es un respaldo **opcional** para nombre exacto/perfil/foto: `GET https://api.cookie-api.com/api/roblox/user?username=...` o `?userid=...`, cabecera `Authorization: COOKIE_API_KEY`. No se utiliza para autenticar usuarios ni reemplazar la búsqueda parcial de Roblox. Solo recibe el ID o nombre público, nunca el expediente ni los secretos OAuth. Su respuesta debe coincidir con el ID/nombre solicitado y la foto debe ser un headshot en un dominio Roblox permitido. No se sigue ninguna redirección.

## Configurar Roblox Creator Dashboard

1. Abre **Creator Dashboard → OAuth 2.0 Apps**, edita tu aplicación.
2. Categoría: **Account Linking Tools**. Permisos mínimos: **openid** y **profile**. Este servicio es un cliente confidencial con backend: conserva el secreto exclusivamente en `.env` y utiliza autorización por código con PKCE S256.
3. Añade exactamente este Redirect URL para el localhost por defecto:

   ```text
   http://localhost:3000/auth/roblox/callback
   ```

   Si cambias `BASE_URL`, host o puerto, cambia también el callback. No mezcles localhost y 127.0.0.1. Para usuarios fuera del equipo utiliza un origen público HTTPS; una URL localhost no publica el sitio.
4. Guarda los cambios. Para pruebas Roblox permite localhost HTTP; para publicar, añade la información del servicio, enlaces públicos **HTTPS** a privacidad/términos y los demás requisitos del panel. El modo privado tiene un cupo de diez usuarios únicos según la documentación consultada; para ampliar el acceso se requiere revisión de Roblox. La autorización requiere una cuenta de 13 años o más.
5. Rota cualquier secreto que hayas compartido en un chat y usa únicamente los valores nuevos en la terminal local. El Client ID es público; el Client Secret y Cookie API Key son secretos. Nunca se necesita una cookie `.ROBLOSECURITY`.

## Configuración local, sin repetir Discord

Actualiza y detén la aplicación antes de cambiar valores:

```bash
bash ~/botprueba/actualizar-linux.sh && bash ~/botprueba/detener-linux.sh && bash ~/botprueba/configurar-roblox-linux.sh && bash ~/botprueba/iniciar-linux.sh
```

El asistente pide Client ID, el secreto Roblox **nuevo** y una clave Cookie API **nueva**, opcional. No muestra los secretos mientras se escriben. Enter conserva un valor anterior; `-` borra un valor. Guarda solamente `ROBLOX_CLIENT_ID`, `ROBLOX_CLIENT_SECRET` y `COOKIE_API_KEY`, conservando el resto de `.env` y permisos 0600. No guarda secretos en Git, argumentos de shell ni historial de comandos. El asistente completo `configurar-linux.sh` también permite configurar estas variables.

## Usarlo

1. Inicia sesión con Discord como de costumbre; la sesión sigue recordándose. Roblox se añade como cuenta vinculada y no sustituye los permisos Discord del panel.
2. Registra tu personaje si no existe. Las cédulas anteriores funcionan sin registrarse otra vez.
3. **Panel ciudadano → Perfil → Cuentas conectadas → Vincular cuenta de Roblox**.
4. Autoriza la aplicación en Roblox. Al volver se guarda el ID/usuario verificado y la miniatura de cabeza. **Actualizar cuenta de Roblox** repite la autorización para refrescar datos.
5. Abre **Mi Cédula** o ejecuta `/ver-cedula`. Los nuevos esquemas/autocompletados Discord se registran al reiniciar el bot.

Se valida state y cookie, sesión de origen, PKCE, perfil retornado y ausencia de otra cédula con esa cuenta Roblox. Se revalida sesión después de la consulta de imagen. Una modificación o cambio de titular durante el proceso cancela la vinculación. Los tokens Roblox se usan solo para consultar el perfil durante el callback y no se entregan al navegador ni se guardan en la cédula.

## Fuentes y verificación

- [Búsqueda oficial de usuarios](https://create.roblox.com/docs/cloud/reference/domains/users).
- [Miniaturas de Roblox](https://create.roblox.com/docs/cloud/reference/domains/thumbnails).
- [Registrar una aplicación OAuth](https://create.roblox.com/docs/cloud/auth/oauth2-registration).
- [Implementación OAuth y PKCE](https://create.roblox.com/docs/cloud/auth/oauth2-develop).
- [Perfil de Cookie API](https://docs.cookie-api.com/en/docs/roblox/get-a-roblox-profile/).

Pruebas automatizadas con proveedores simulados: predicción parcial, caché, concurrencia, timeout, 429, acceso a las plantillas, resolución de headshots, respaldo Cookie API, PKCE, repetición de callback, cuenta duplicada, cambio de registro y logout durante consulta. La red del entorno de desarrollo no permite comprobar directamente los servicios Roblox/Cookie API; se revisó su documentación y no se usaron los secretos expuestos. La autorización real debe completarse en el navegador con los nuevos secretos configurados localmente.
