# Inicio exclusivo con Discord (3.9)

La web ya no acepta usuarios ni contraseñas locales. Los valores anteriores
`LOCAL_ADMIN` y `LOCAL_PASSWORD_HASH` se ignoran; el asistente ya no los pide.
El portafolio público y la demo siguen disponibles sin cuenta. Las operaciones
protegidas requieren Discord y los roles correspondientes.

## Discord Developer Portal

1. Abre https://discord.com/developers/applications y selecciona tu aplicación
   (puedes usar la misma del bot).
2. Copia **Application ID** de **General Information**. Es `DISCORD_CLIENT_ID`.
3. En **OAuth2**, copia el **Client Secret**. Es `DISCORD_CLIENT_SECRET` y es
   diferente del **Bot Token**. No lo publiques ni lo pegues en el chat.
4. En **OAuth2 → Redirects**, añade y guarda exactamente:

   ```text
   http://localhost:3000/auth/discord/callback
   http://localhost:3000/admin/auth/discord/callback
   ```

   Si cambias `BASE_URL` o el puerto, actualiza ambas direcciones. Usa siempre
   `localhost` al entrar para que coincidan la cookie y el retorno OAuth.
5. La aplicación solicita automáticamente los scopes `identify` y
   `guilds.members.read`; no necesitas crear a mano un enlace de autorización ni
   activar el flujo implícito. No pide el scope `email` ni permisos de bot para
   autenticar al visitante.
6. En Discord activa **Ajustes de usuario → Avanzado → Modo desarrollador**.
   Copia el ID del servidor y los IDs de los roles autorizados. La persona debe
   pertenecer al servidor configurado para completar el acceso.

## Configuración local

Actualiza primero y detén la aplicación antes de cambiar la configuración:

```bash
bash ~/botprueba/actualizar-linux.sh && bash ~/botprueba/detener-linux.sh && bash ~/botprueba/configurar-linux.sh
```

Responde las preguntas y, al terminar, inicia de nuevo:

```bash
bash ~/botprueba/iniciar-linux.sh
```

Responde al asistente con estos valores:

| Variable | Valor |
| --- | --- |
| `DISCORD_CLIENT_ID` | Application ID |
| `DISCORD_CLIENT_SECRET` | Client Secret de OAuth2 |
| `DISCORD_GUILD_ID` | ID del servidor Maes RP |
| `POLICE_ROLE_IDS` | IDs de los roles policiales, separados por comas |
| `ADMIN_GUILD_ID` | ID del servidor administrativo; puede ser el mismo de Maes RP |
| `ADMIN_ROLE_IDS` | IDs de los roles administrativos, separados por comas |
| `DISCORD_TOKEN` | Bot Token, solo si quieres ejecutar también el bot |

No hace falta un dominio para usarlo localmente. Abre
http://localhost:3000/maes-rp y pulsa **Entrar con Discord**. La imagen de perfil,
el usuario y el menú personal aparecen en la esquina superior izquierda. Los roles
administrativos no conceden por sí solos funciones policiales: configura ambos
accesos si una persona necesita ambos. Los roles del bot también se conservan.

## Sesión recordada

La cookie `session` dura hasta **30 días**, es HttpOnly y SameSite=Lax y usa
Secure cuando `BASE_URL` es HTTPS. No se guardan credenciales en localStorage.
La referencia del navegador está firmada; los tokens OAuth y el perfil se
persisten cifrados con AES-256-GCM en `bot/data/web-sessions.sqlite`, privado y
excluido de Git. Recargar, cerrar el navegador o reiniciar la aplicación conserva
la sesión, siempre que el navegador no borre las cookies.

Se renueva el acceso de Discord mediante su refresh token cuando corresponde.
Cerrar sesión invalida inmediatamente la sesión persistida; cambiar `JWT_SECRET`,
revocar la autorización en Discord o llegar a la caducidad exige volver a entrar.
Conserva `JWT_SECRET` durante las actualizaciones. Los roles se verifican de nuevo
al recuperar sesiones tras un reinicio, periódicamente y antes de las operaciones
que modifican datos. Una caída del proveedor no concede permisos adicionales.

La automatización usa un proveedor simulado para comprobar OAuth, renovación,
roles y persistencia. La autorización real se debe completar en el navegador con
la aplicación y las credenciales del propietario.
