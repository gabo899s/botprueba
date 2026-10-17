# Revisión de seguridad 3.10

Se revisaron la web de InfiniteDev/Maes RP, el acceso Discord, los registros y
archivos, el bot ER:LC/Discord y los scripts Linux. Cuatro agentes revisaron áreas
separadas y el agente principal integró y comprobó las correcciones. Las pruebas
usaron copias aisladas, datos ficticios y proveedores simulados. No se utilizaron
cuentas reales, tokens del propietario ni acciones reales en Discord/ER:LC.

## Hallazgos confirmados y correcciones

| Área | Problema reproducido | Corrección |
| --- | --- | --- |
| Archivos privados | Una URL codificada de otra forma podía eludir la autorización de una transcripción. | Un único nombre canónico validado para autorización y entrega; separación por categoría y registro; archivos huérfanos denegados. |
| Titularidad | Reutilizar una cédula podía entregar multas, arrestos o exportaciones del titular anterior. | El dueño explícito tiene prioridad; el número solo sirve de respaldo para registros heredados sin dueño. |
| Identidades PDF | Un nombre fijo podía conservar una tarjeta de otro titular o una versión antigua. | Nombre ligado a una huella del dueño y campos mostrados; invalidación tras commit al cambiar identidades; una generación antigua no coincide con la identidad nueva. |
| Permisos | La excepción administrativa compartida con el bot permitía confirmar pagos sin rol policial en la web. | Comprobación policial explícita en ese endpoint; administración y policía siguen separados. |
| Sesiones | Una caída de Discord impedía cerrar sesión; una petición retenida podía continuar después de logout o rotación. | Cierre local de los tres portales y comprobación de vigencia de la misma sesión después de esperar al proveedor. |
| Documentos HTTP | Faltaba el cupo en multas y una desconexión liberaba el cupo antes de terminar el trabajo. | Cupo compartido multas/arrestos y liberación al terminar la operación real, no al cerrar el socket. |
| Documentos del bot | Comandos públicos podían generar muchos PDF simultáneamente. | Dos trabajos simultáneos, uno por actor y seis admisiones por minuto. |
| Soporte | Creación de canales y transcripciones sin límites suficientes. | Espera entre altas, reservas y cupos de tickets/canales; transcripción por páginas con límites explícitos y limpieza de temporales. |
| Eventos del bot | Mensajes de servidores ajenos y mensajes ordinarios reescribían tickets innecesariamente. | Servidores permitidos, escritura únicamente cuando existe ticket y agrupación de actividad. |
| ER:LC | Un supuesto usuario individual podía interpretarse como selector masivo; la cola de solicitudes no tenía cupo. | Destinatarios individuales por ID canónico, selectores restringidos y máximo de 32 solicitudes pendientes. |
| Integridad de CK | Se buscaba la identidad por una clave distinta de la utilizada al registrarla. | Se localiza por propietario real, se elimina correctamente y se conservan registros de terceros. |
| Almacenamiento | Datos heredados, carpetas, logs o exportaciones podían conservar permisos demasiado amplios. | Carpetas privadas 0700, datos 0600, migración sin borrar registros, exportaciones atómicas, rechazo de enlaces internos y umask restrictiva. |
| Transporte/configuración | Una URL HTTPS con mayúsculas no activaba todas las comprobaciones; HTTP remoto permitía autenticación sin cifrar el transporte. | URL normalizada a su origen y autenticación remota exclusivamente sobre HTTPS; localhost sigue funcionando por HTTP. |

También se mantienen las comprobaciones existentes de CSRF, JWT alterado,
reutilización de OAuth state, separación de cuentas, validación de imágenes,
idempotencia, límites de peticiones y sesiones de 30 días cifradas. Las lecturas
revalidan roles con una caché máxima de 30 segundos; las mutaciones los revalidan
antes de ejecutarse.

## Datos y cifrado

Las sesiones/tokens OAuth están cifrados con AES-256-GCM y no se exponen al
navegador ni en las exportaciones individuales. Sus directorios y archivos están
restringidos al usuario del servicio.

Los expedientes, colas, tickets, PDF y evidencias siguen siendo legibles por la
aplicación y por quien controle su proceso, disco o claves. **No se implementó
cifrado de extremo a extremo ni se promete ocultar esos datos al propietario.**
Cambiar esto exige claves exclusivamente en los dispositivos de los usuarios,
destinatarios y recuperación de claves; las búsquedas, moderación, documentos y
el bot no podrían utilizar esos datos del mismo modo. Las copias que ya están en
Discord o descargadas tampoco se protegen retroactivamente.

Véase [el alcance del cifrado y los permisos](privacy-security.md).

## Efectos al actualizar

- Las sesiones válidas se conservan; el portafolio y el acceso Discord siguen disponibles.
- HTTP en localhost continúa igual. Para autenticación desde otra máquina se
  requiere una URL HTTPS y los callbacks OAuth correspondientes. La web pública
  puede mostrarse por HTTP; eso no habilita las operaciones privadas.
- Las cachés antiguas `cedula_NUMERO.pdf` deben regenerarse con los comandos de
  cédula. Los PDF históricos de multas/arrestos mantienen su identificador.
- Se conservan datos, exportaciones y respaldos anteriores; no hay borrado
  automático. Los respaldos antiguos fuera de las carpetas protegidas requieren
  la política de conservación y protección que decida el responsable.
- Los archivos privados enlazados o enlaces internos a otros archivos se rechazan
  con `EPRIVATEPATH`. Una raíz de datos configurada como enlace a una carpeta
  dedicada sigue siendo compatible. No se cambian permisos de ejecutables.
- Los límites de documentos y tickets pueden pedir esperar antes de repetir;
  una transcripción excesiva falla explícitamente y mantiene el ticket abierto.

## Validación y límites

Las regresiones están en `test/auth-audit.test.js`,
`test/file-access-security.test.js`, `test/record-ownership.test.js`,
`test/storage-permissions.test.js`, `test/transport-security.test.js`,
`test/bot-security-audit.test.js` y
`test/security-limits.test.js`, además de la suite existente.

Resultado de esta versión: **151 pruebas aprobadas en Node 22.13 y Node 24**,
seis scripts Linux válidos con `bash -n` y **0 alertas conocidas** en `npm audit`. El resultado describe esta revisión del código;
no es una certificación, una auditoría de infraestructura desplegada ni una
promesa de que no existan más vulnerabilidades. Faltan pruebas con los permisos
reales de la aplicación Discord y del servidor ER:LC del propietario, un proxy
HTTPS real y sus copias de seguridad.
