# InfiniteDev + Maes RP + bot Discord/ER:LC

Proyecto completo de `gabo899s/botprueba`. La portada es InfiniteDev; **Productos digitales → Sistema Completo para Rolplay** abre Maes RP. El panel ciudadano tiene la distribución de las referencias con el negro, rojo y blanco de Maes RP. Se mantienen los 78 comandos y las funciones previas.

## Instalar desde GitHub una sola vez

En Linux, detén cualquier versión anterior con **Ctrl+C** y ejecuta:

```bash
archivo="$(mktemp)" && curl -fsSL https://raw.githubusercontent.com/gabo899s/botprueba/main/instalar-github.sh -o "$archivo" && bash "$archivo"
```

El instalador clona en `~/botprueba`, instala Node compatible si hace falta y comprueba la aplicación. En Debian/Ubuntu/Chromebook instala los requisitos ausentes. Si encuentra una instalación previa conocida, recupera `.env`, roles, base de datos y documentos sin borrar la carpeta anterior. Si no hay configuración, abre el asistente una vez. La migración ocurre antes de iniciar; detén la versión anterior para que la base de datos no esté siendo escrita.

Una carpeta `~/botprueba` que no sea un repositorio se conserva con el sufijo `-anterior-fecha-hora`. No se descarga ningún ZIP.

## Comandos habituales

**Actualizar todo** — comprueba GitHub, respalda datos, instala dependencias, ejecuta pruebas y reinicia si la aplicación estaba encendida:

```bash
bash ~/botprueba/actualizar-linux.sh
```

**Iniciar web y bot** — queda en segundo plano y puedes cerrar la terminal:

```bash
bash ~/botprueba/iniciar-linux.sh
```

**Detener:**

```bash
bash ~/botprueba/detener-linux.sh
```

Abre **http://localhost:3000**. El puerto configurado en `.env` se conserva. `/maes-rp` es la demo y `/ciudadano` el panel del ciudadano.

**Ver registros:**

```bash
tail -f ~/botprueba/.runtime/app.log
```

**Cambiar configuración:**

```bash
bash ~/botprueba/detener-linux.sh && bash ~/botprueba/configurar-linux.sh && bash ~/botprueba/iniciar-linux.sh
```

## Qué se conserva al actualizar

`.env`, `bot/config.json`, `bot/data`, `public/pdfs`, `public/uploads` y `.runtime` son locales y están excluidos de Git. No se publican tokens ni datos reales. Los respaldos están en `.runtime/respaldo-*`. Si el código tiene cambios locales, el actualizador se detiene y los conserva; no usa reset ni force-push. Una actualización fallida no arranca código que no pasó las comprobaciones.

Los cambios futuros solicitados por el usuario se suben a este repositorio después de comprobarlos. La rama de instalación es `main`.

## Diseño y funciones

InfiniteDev tiene un aura azul/celeste que aparece desde negro. Se mueve lentamente hasta terminar la carga, desacelera y queda fija sin saltar de posición. `prefers-reduced-motion` muestra una versión estática. No requiere servicios externos de efectos ni bibliotecas de UI adicionales. Tipografías, iconos y recursos gráficos están incluidos localmente.

Maes RP conserva sus funciones y su identidad roja/blanca/negra. Los módulos ciudadanos pendientes muestran «Próximamente» y una explicación. DOT, bomberos y bandas se muestran solo con sus roles autorizados; su contenido sigue en preparación. El banco no inventa saldos. Los visitantes sin sesión ven una demo sin acceder a datos reales.

Discord y ER:LC necesitan tus credenciales. Las imágenes locales ausentes no se inventaron; los mensajes pueden usar `public/images/wlaceptada.png` y `wlrechazada.png` si se aportan. La bienvenida por voz necesita FFmpeg y permisos Conectar/Hablar.

## Panel ciudadano · 3.11

Perfil de Discord actualizable, vinculación Roblox verificada por OAuth y correcciones de datos del personaje revisadas por administración. El expediente separa multas y arrestos, incorpora filtros y permite presentar y seguir apelaciones. Las notificaciones personales conservan su estado de lectura. El soporte permite abrir tickets y leer/responder conversaciones que se sincronizan con Discord.

El bot debe estar conectado y tener sus roles/permisos de soporte configurados para crear tickets y acceder a las conversaciones. Los avisos informan cuando no está disponible. No se habilitan saldos, compras, casas ni transferencias ficticias. Los detalles de configuración y límites están en [docs/citizen-panel-3.11.md](docs/citizen-panel-3.11.md).

## Verificación y documentación

```bash
cd ~/botprueba && npm test
```

69 pruebas automatizadas: API, DOM, comandos, persistencia, aura y arranque/cierre de Linux; el actualizador se prueba con un remoto Git local y npm simulado. Auditoría productiva: cero vulnerabilidades reportadas al preparar esta versión. No se han ejecutado operaciones reales en cuentas Discord/ER:LC del usuario ni una revisión visual automatizada en navegador.

- `docs/RECONSTRUCCION-DESDE-PROMPTS.md`: origen y límites de la reconstrucción.
- `docs/INDICE-CHATS.md`: índice del material recuperado.
- `docs/COMANDOS.md`: comandos y sus fuentes.
- `docs/CAMBIOS-WEB-3.1.md`: adaptación del portfolio y perfil.

El archivo `docs/INSTALACION-ANTERIOR.md` conserva las instrucciones históricas de ZIP como referencia; para el uso actual sigue esta página.


Compatibilidad: Node 22.13 o superior de la rama 22, o Node 24 o posterior. Node 20 no incluye la API SQLite que usa el sistema. El instalador de Linux conserva una versión compatible o instala Node 24.

El acceso sigue siendo local por defecto. Para un servidor o una IP de red, configura `BASE_URL` con la dirección completa, por ejemplo `https://panel.ejemplo.com`. Desde 3.10, la autenticación fuera de localhost requiere HTTPS; HTTP remoto solo permite las páginas públicas. Ese host se acepta junto a localhost; los hosts ajenos siguen rechazados. Si necesitas conexiones directas desde otras máquinas, establece también `LISTEN_HOST=0.0.0.0` en `.env`. Con un proxy inverso en el mismo equipo puedes conservar `127.0.0.1`. Reinicia la aplicación después de cambiar `.env` y actualiza las URLs de retorno OAuth en Discord/Roblox cuando cambies la dirección. Esto configura el acceso; no publica ni aloja la web por sí solo.

La versión 3.5.0 incorpora rotación de sesión, revalidación de roles de Discord y límites de solicitudes/evidencias. La verificación de permisos puede devolver 503 si Discord no responde; los límites por IP se comparten cuando hay un proxy sin configurar. Consulta `docs/AUDITORIA-SEGURIDAD-3.5.0.md` para ver los fallos reproducidos, las correcciones y los límites de esta revisión.

Las páginas `/legal`, `/privacidad`, `/terminos`, `/cookies` y `/derechos` y el comando `/privacidad` explican datos, condiciones y cookies necesarias. Hay descarga de datos propios y solicitudes de privacidad con revisión administrativa. Completa el bloque de información legal pública en `bash configurar-linux.sh` antes de publicar. Consulta `docs/PRIVACIDAD-Y-PUESTA-EN-SERVICIO.md`: los textos mantienen una advertencia de preparación si faltan responsable, correo o país y no garantizan cumplimiento legal integral.

## Inicio de sesión con Discord

Desde 3.9 la web solo admite Discord OAuth2, sin usuario ni contraseña local. La sesión se recuerda hasta 30 días y sobrevive a reinicios del servidor; la foto y el perfil aparecen arriba a la izquierda en Maes RP. Configuración de Discord Developer Portal, callbacks, roles y comandos: [guía completa](docs/discord-login.md).

## Auditoría de seguridad 3.10

Se corrigieron accesos a archivos privados, asociación de registros por cédula, separación de roles, cierre de sesiones y límites de recursos. Consulta [el informe de cambios y verificación](docs/security-audit-3.10.md) y [el alcance real del cifrado](docs/privacy-security.md). Los registros operativos no están cifrados de extremo a extremo ni ocultos al operador del servidor.
