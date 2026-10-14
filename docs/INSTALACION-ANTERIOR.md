# InfiniteDev + demo Maes RP · versión 3.1.0

Al abrir http://localhost:3000 se muestra el portfolio del HTML adjunto. Productos digitales → Sistema Completo para Rolplay abre /maes-rp. El perfil ciudadano está en /ciudadano y usa una vista de ejemplo cuando no hay sesión. Las operaciones reales siguen requiriendo una sesión válida.

Los botones sin función del perfil son intencionalmente inactivos. El banco no muestra saldos inventados. El menú de productos, los formularios del portfolio, las consultas, PDFs, solicitudes de pago y apelaciones mantienen su comportamiento. El portfolio abre Discord al terminar el formulario; no transmite pedidos automáticamente.

# Maes RP · reconstrucción desde los prompts

Versión 3.0.0. 78 comandos en archivos individuales. Lee docs/RECONSTRUCCION-DESDE-PROMPTS.md para ver lo recuperado, las correcciones, las excepciones de formato y los límites. El análisis anterior se conserva como histórico.

# Maes RP reconstruido · Bot ER:LC / Discord y web local

Reconstrucción desde los archivos recuperados y las correcciones verificadas en esta sesión. Incluye web Maes RP, bot de Discord, cliente ER:LC y almacenamiento SQLite común. BotGhost, Minibot y CRCity quedan fuera. Todos los tokens, servidores, roles y canales externos están vacíos.

Consulta **docs/ANALISIS-RECUPERACION.md** para la elección de fuentes, **docs/selecciones.json** para los hashes de los módulos y **docs/inventario-3355-archivos.json** para todos los archivos originales. Las fuentes saneadas en docs/fuentes-saneadas son material de revisión, no se ejecutan.

## Instalar en Chromebook / Debian / Ubuntu / Mint

Descarga `maesrp-desde-prompts.zip`, muévelo a **Archivos Linux** (en Chromebook) y abre la terminal:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl unzip xz-utils ffmpeg
unzip infinitedev-maesrp.zip
cd infinitedev-maesrp
bash instalar-linux.sh
```

Responde el asistente hasta ver **Configuración guardada**. No pegues el siguiente comando mientras está preguntando. Después:

```bash
bash iniciar-linux.sh
```

Abre **http://localhost:3000** en el navegador del mismo equipo. Si escogiste otro puerto, usa la dirección que muestra la terminal. Ctrl+C detiene web y bot. No necesitas dominio, Nginx ni Certbot.

El instalador usa Node.js >=24.15 si está disponible; si no, descarga Node 24 oficial, verifica SHA256 y lo instala dentro de `.runtime/node/`. No necesita sudo para Node. El módulo de voz utiliza el paquete nativo DAVE con binarios precompilados; puede necesitar herramientas de compilación si no existe binario para tu plataforma. SQLite viene con Node, no tienes que instalar un servidor de base de datos. Necesita Internet para paquetes; x86_64 o ARM64 con glibc >=2.28. No compatible con Alpine/musl ni ARM de 32 bits.

Fedora: instala primero `sudo dnf install -y ca-certificates curl unzip xz tar coreutils gawk`. Arch: `sudo pacman -Syu --needed ca-certificates curl unzip xz tar coreutils gawk`. Después usa unzip e instalar-linux.sh como arriba.

Si ya tienes Node/npm compatibles en PATH:

```bash
npm ci
npm run setup
```

Después de configurar, por separado:

```bash
npm test
npm start
```

## Configuración inicial y posterior

```bash
# Con el proyecto detenido:
bash configurar-linux.sh
```

Pide puerto, administrador/contraseña local, token Discord, aplicación/secreto OAuth, servidor Discord, roles policiales, canales de multas/arrestos, roles de licencias, servidor y roles administrativos, credenciales Roblox, Server Key ER:LC y clave global opcional, y token opcional de UnbelievaBoat. Enter acepta el valor existente/default; `-` elimina un valor opcional. Contraseña y tokens no se muestran en una terminal interactiva. `.env` tiene permisos 600 y la contraseña se guarda con scrypt.

Puedes omitir Discord, Roblox, ER:LC y economía, y usar la web inmediatamente. Los secretos no se muestran en el navegador. Para configurar **todos los roles, canales y políticas del bot** entra con el administrador local en:

**http://localhost:3000/config**

Roles de staff/moderador/administrador/policía, roles de whitelist y licencias, niveles de sanción, canales de logs/tickets/aperturas/jerarquía, canal de voz, mínimos de turno y exámenes. Guardar aplica los cambios al bot sin reiniciar. La clave ER:LC y el token Discord requieren reiniciar después de cambiarlos en el asistente.

## Discord, paso a paso

1. Crea una aplicación en https://discord.com/developers/applications.
2. En Bot, obtén el token. Activa **Server Members Intent** y **Message Content Intent**: se usan para jerarquía, nombres de staff y transcripciones. Si faltan, Discord puede rechazar la conexión. Guilds/Voice States se solicitan sin switches privilegiados adicionales.
3. En General Information copia Application ID y, para acceso web Discord, en OAuth2 copia Client Secret.
4. Agrega exactamente estos callbacks (ajusta el puerto si lo cambiaste):
   - `http://localhost:3000/auth/discord/callback`
   - `http://localhost:3000/admin/auth/discord/callback`
5. Invita el bot con scopes **bot** y **applications.commands**. Permisos usados: View Channels, Send Messages, Embed Links, Attach Files, Read Message History, Manage Channels, Manage Roles, Manage Nicknames. Coloca el rol del bot por encima de los roles que va a asignar y los miembros que va a gestionar. No requiere Administrator.
6. Activa Modo desarrollador en Discord para copiar IDs de servidor, roles, categorías y canales. Configura tus IDs desde el asistente y /config.
7. `bash iniciar-linux.sh` conecta el bot y registra los comandos en los servidores configurados.

Usa una aplicación dedicada: el registro reemplaza sus comandos de servidor. Un rol policial no concede permisos de administración/staff; configura cada permiso por separado. Los usuarios con Administrator de Discord pueden usar los comandos administrativos. El servidor de administración puede ser distinto; el bot debe estar invitado a ambos.

Los componentes de tickets, exámenes y encuestas funcionan tras reiniciar porque consultan registros persistentes; no dependen de collectors temporales. Los exámenes tienen 15 minutos de duración y cada respuesta verifica usuario, examen e índice. Una solicitud de whitelist aprobada queda en segunda fase hasta que el staff la revise.

## API ER:LC

Necesitas el **API Pass** del servidor privado y su **Server Key**. Introduce la clave en `bash configurar-linux.sh`. El cliente usa `https://api.policeroleplay.community/v1` y el header `Server-Key`. No se realizan pruebas que escriban mensajes automáticamente para adivinar endpoints.

`/erlc estado`, `jugadores`, `vehiculos`, `cola`, `baneos`, `diagnostico` y `command` permiten consultar o ejecutar los comandos recuperados. :ban, :unban y :kill mediante la consola requieren administración. El bot no inventa una API de multas del juego: los registros policiales pertenecen a Maes RP.

`/banear` guarda el resultado como aplicado o no confirmado. No informa éxito cuando la API falla. Los bans temporales confirmados se retiran al expirar, siempre que ER:LC responda. Una operación con resultado incierto no se reintenta automáticamente; revisa el juego antes de repetir. Cambiar estado-sv actualiza la apertura local, no inicia ni apaga el servidor Roblox.

## Páginas y funciones

- `/`: portada nativa Maes RP, login local/Discord y perfil.
- `/v2/police`: dashboard policial recuperado, consulta predictiva, identidad, licencias, vehículos, multas, arrestos y PDFs con evidencia PNG/JPEG.
- `/police-tools`: alta/edición de ciudadanos, vehículos y licencias manuales, historial y cola.
- `/admin`: registro de staff, sanciones hechas, horas, tickets y evaluaciones. Las entradas manuales se distinguen de lo medido por el bot.
- `/staff`: turnos y descansos, LOA/ausencias, búsquedas, moderación, ban/desban y ranking real. Edición/revocación/apelaciones usan backend; no hay estadísticas Math.random.
- `/ciudadano`: solo el expediente del ciudadano conectado, solicitud de pago, apelaciones y tickets propios.
- `/config`: parámetros y IDs del bot. Solo administración.

El administrador local puede acceder a todo. Las sesiones Discord tienen solo los permisos concedidos por roles. Ciudadanos no pueden abrir documentos ajenos ni consultar registros de staff. El proceso usa sesiones HttpOnly que se invalidan al reiniciar.

La cédula genera un PDF nuevo con los datos del personaje, porque no se recuperaron los recursos gráficos originales. Documentos de ficción; sin validez legal. Las fotografías externas de la portada necesitan Internet; fuentes, iconos y CSS están incluidos localmente. El logo es provisional y puedes reemplazar public/images/logo.png.

## Familias del bot

El catálogo exacto de comandos implementados se encuentra en **docs/COMANDOS.md**. Incluye:

- Cédulas, vehículos, licencias y exámenes recuperados.
- Whitelist en dos fases, aceptación/rechazo y roles.
- Multas/arrestos integrados con la web y notificaciones con PDF adjunto.
- Sanciones, advertencias, historial, apelación y aprobación de castigos.
- Baneos ER:LC con expiración y resultado real.
- Turnos, pausas, mínimo de duración, control por voz y ranking.
- Aperturas, votos únicos persistentes y cierre de turnos.
- Tickets privados, reclamación, transcripción, evaluación e inactividad. Alto volumen activa slowmode de 60 segundos.
- Mensajes personalizados Components V2: texto, `[separador]` y galerías de imágenes Discord, sin content incompatible.
- Evaluación de staff, identificadores, sincronización de nombres y jerarquía.

Una sanción se registra primero. Castigos de kick/ban pendientes requieren `/aprobar-castigo` o la aprobación desde /staff; debe existir un usuario Roblox válido asociado. Las sanciones revocadas se conservan para auditoría. El reset de apodo se aplica por miembro, no borra masivamente apodos. Los ejemplos destructivos de /developer no se habilitaron; los demos de componentes se cubren con /prueba y tests.

Para jerarquía escribe en /config una línea por cargo: `Nombre del cargo | ID del rol`. Los roles de licencia se configuran individualmente. `/revisar-licencias` sincroniza roles sin borrar licencias manuales o aprobadas por examen.

## Moneda ficticia y multas

Sin economía configurada, `/pagar-multa` crea una solicitud de validación manual; un policía verifica un comprobante/referencia desde el dashboard y confirma el pago. No se simula un cobro exitoso.

Con un token de UnbelievaBoat configurado, `/pagar-multa` verifica saldo y solicita un débito PATCH en su API. Si no se puede confirmar el resultado, la multa queda bloqueada para evitar cobro repetido: revisa la cuenta y resuelve mediante validación administrativa. Es dinero del bot, no pagos reales.

El cobro automático de multas vencidas existe pero está **desactivado por defecto**. Solo actívalo en /config si quieres esa política de moneda ficticia. Se revisan vencimientos de registros creados con el bot; las multas anteriores sin fecha de vencimiento no reciben una inventada.

## Datos, importación y copia

El estado está en `bot/data/maesrp.sqlite`. No hay datos productivos ni `.env` en el ZIP. La web y el bot arrancan juntos en un proceso principal; no arranques otro bot simultáneo.

Para exportar datos a JSON, con el proyecto detenido:

```bash
cd ~/maesrp-reconstruido
export PATH="$PWD/.runtime/node/bin:$PATH"
npm run data -- export exportacion-datos
```

Para importar bases antiguas revisadas, colócalas en una carpeta (por ejemplo `datos-antiguos`). El importador admite cédulas, vehículos, licencias, multas/arrestos, staff, etc., por sus nombres documentados en `lib/store.js`. No ejecuta JS. Un `infostaff.js` solo se acepta si es `module.exports =` seguido de JSON literal válido. Colisiones y errores revierten toda la importación.

```bash
npm run data -- import datos-antiguos
```

No copies los archivos JS recuperados a commands/ ni los ejecutes: son versiones alternativas con dependencias/credenciales retiradas. El bot implementado tiene un catálogo único.

Copia privada completa, con web/bot detenidos:

```bash
tar -czf copia-maesrp.tar.gz .env bot/config.json bot/data public/pdfs public/uploads
chmod 600 copia-maesrp.tar.gz
```

La copia contiene secretos. No la compartas. Si usabas el proyecto anterior, no sobrescribas tu carpeta: instala esta reconstrucción en **maesrp-reconstruido** e importa datos desde una copia. Bases antiguas completas no estaban dentro del archivo recuperado.

## Cambiar configuración, iniciar y probar

```bash
# Configurar (responde hasta que termine):
bash configurar-linux.sh
```

Después:

```bash
bash iniciar-linux.sh
```

Si Node es privado, los comandos npm manuales necesitan primero:

```bash
export PATH="$PWD/.runtime/node/bin:$PATH"
npm test
```

Puerto ocupado: cambia el puerto con el asistente y los callbacks OAuth. Token inválido/intents: la web sigue disponible y la terminal informa del fallo. PDF/evidencia requieren sesión y permisos. PNG/JPEG máximo 5 MB. Para ejecutar en una máquina remota, localhost se refiere a esa máquina: usa un túnel SSH si necesitas acceder desde tu equipo.

Roblox OAuth es opcional; puede rechazar HTTP localhost según la configuración de su aplicación. La búsqueda pública de usuarios por nombre no demuestra que esa persona controle un Discord. La identidad se vincula solo con una sesión activa Discord/OAuth válida o mediante registro administrativo.

## Verificación y alcance

Consulta VALIDACION.md para las pruebas. Se probaron HTTP, DOM, almacenamiento y contratos simulados de servicios externos. No se realizaron acciones reales con cuentas Discord, ER:LC, Roblox o UnbelievaBoat del usuario ni se garantiza ausencia de errores en todas las distribuciones/proveedores. Los hashes del inventario permiten comprobar qué materiales se analizaron. No se recuperaron archivos históricos que el ZIP no contenía.

El modo `/joiner modo:voz` recupera la bienvenida del chat original. Necesita FFmpeg en Linux, permisos Conectar/Hablar y acceso al servicio TTS. `/joiner` sin modo conserva el envío del código de Maes RP.

## Configurar el bot

Ejecuta `bash configurar-linux.sh`. Tras los datos generales, responde **s** a configurar roles y canales adicionales para que el asistente solicite los IDs. Puedes dejarlos vacíos para completarlos después desde el panel de configuración. Los roles de licencia, sanción y ban también se preguntan individualmente. La jerarquía se proporciona como una lista ordenada de nombres e IDs.

El panel de turnos requiere canal activity y activityPanelEnabled. El control de voz está activado de forma predeterminada: configura voiceActivity o los roles exentos. Las cuentas de Discord requieren los intents Server Members, Message Content y el permiso para Conectar/Hablar si se usa voz.

Las claves de /configurar-texto son pie, titulo:Título actual y cuerpo:Título actual. Usa {contenido} para conservar los datos de la respuesta. /restablecer-texto restaura el texto original.

Para personalizar un mensaje puedes ejecutar /crear-mensaje sin nombre/contenido y seguir las preguntas en el mismo canal. /enviar-mensaje permite buscar los nombres guardados mediante autocompletado.

No sustituyas una carpeta con datos por la entrega limpia: conserva .env, bot/config.json, bot/data, public/pdfs y public/uploads si estás actualizando una instalación existente.
