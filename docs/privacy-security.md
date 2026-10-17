# Seguridad y alcance del cifrado

La web acepta únicamente Discord OAuth2. No recibe las contraseñas de Discord
ni necesita pedirlas. Los datos de personaje deben ser ficticios: no se deben
introducir documentos de identidad reales, información bancaria, datos médicos
ni contraseñas en formularios, evidencias o tickets.

## Qué se protege y contra quién

- Las sesiones persistentes y sus tokens OAuth utilizan AES-256-GCM. El navegador
  recibe una referencia de sesión firmada mediante una cookie HttpOnly, no los
  tokens del proveedor. El cifrado autentica también el contenido persistido.
- Al iniciar, los directorios gestionados de datos, documentos, evidencias y
  `.runtime` se limitan al usuario de Linux que ejecuta la aplicación (`0700`).
  Sus archivos de datos, incluidos JSON heredados, se protegen con `0600`.
  `.env` y `bot/config.json` existentes también se limitan a `0600`.
- Las exportaciones administrativas completas se crean en una carpeta `0700`
  y sus archivos se reemplazan de forma atómica con permisos `0600`, incluso si
  existía una exportación anterior con permisos más abiertos.
- La aplicación no cambia los permisos de sus recursos públicos ni de los
  ejecutables de Node. Los enlaces simbólicos internos en datos o documentos
  privados y los archivos enlazados de secretos se rechazan expresamente para
  no seguirlos hacia archivos ajenos.
  Una ruta raíz de datos enlazada a una carpeta dedicada sigue siendo válida.

Estos permisos separan las cuentas normales de Linux. No impiden acceder al
usuario que ejecuta el servicio, al administrador del equipo, a procesos con
sus mismos privilegios ni a quien tenga acceso al disco o a un respaldo fuera
de esas carpetas. No equivalen a cifrar todos los datos.

## Límites importantes

Los registros de personaje, moderación, tickets, colas, PDF y evidencias deben
poder ser leídos por el servidor para realizar las funciones existentes. El
estado SQLite y los documentos no tienen cifrado de extremo a extremo. El
operador con acceso al servidor puede leerlos. Incluso los tokens cifrados de
sesión pueden ser descifrados por el proceso que dispone de la clave.

**No se ofrece la garantía de que el propietario del servidor no pueda leer
los datos.** Para conseguir esa propiedad sería necesario otro diseño: cifrado
en los dispositivos de los usuarios con claves que nunca lleguen al servidor,
gestión de destinatarios y recuperación de claves. El contenido cifrado así
no podría usarse sin más para búsquedas policiales, moderación, generación de
PDF ni comandos del bot. Un operador que puede modificar la web entregada al
navegador también queda dentro de ese modelo de amenaza.

Discord recibe las interacciones, adjuntos y mensajes que el bot le envía. Sus
copias y las descargas de terceros quedan fuera del control de los permisos de
este servidor. El cifrado local no las protege retroactivamente. Los respaldos
antiguos también conservan los datos que ya contenían y requieren una revisión
y una política de conservación propias; este cambio no los elimina.

## Alojamiento

HTTP en `localhost` está pensado para el equipo local. Antes de atender usuarios
por Internet se necesita HTTPS: la aplicación rechaza la autenticación si la URL
pública es HTTP y no es loopback. También se necesita una configuración correcta de la URL pública,
roles limitados, actualizaciones y un responsable/contacto de privacidad real.
La protección de transporte depende también del alojamiento y del proxy.

Conviene ejecutar la aplicación con una cuenta Linux dedicada sin privilegios,
usar cifrado del disco y respaldos cifrados cuya clave se custodie por separado.
Si el mismo respaldo incluye los datos y las claves necesarias para abrirlos,
no protege frente a quien consigue leer ese respaldo completo.

La exportación `npm run data -- export` contiene datos de todas las cuentas y
es una herramienta del operador. No debe compartirse con un usuario como si
fuera su copia personal. La descarga autenticada de privacidad es individual.
Ninguna de estas medidas permite prometer ausencia absoluta de vulnerabilidades.

Las identidades PDF nuevas incluyen una huella del titular y de sus campos. Al
cambiar de titular o contenido, una tarjeta antigua deja de ser una identidad
autorizada, incluso si había una generación anterior en curso. Las tarjetas
antiguas con nombres sin huella deben regenerarse con los comandos existentes;
las multas y arrestos conservan sus identificadores.
