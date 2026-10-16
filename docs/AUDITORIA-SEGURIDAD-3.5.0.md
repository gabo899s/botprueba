# Auditoría de seguridad y correcciones · 3.5.0

## Alcance y método

Base revisada: e2aac08 (3.4.2). Revisión estática del servidor, autenticación, OAuth, permisos y comandos de Discord, almacenamiento SQLite, generación de PDF, subida de evidencias, transcripciones, peticiones externas y JavaScript del navegador. Pruebas HTTP contra una copia aislada con registros ficticios; Discord y Roblox se simularon. Se revisaron los 78 esquemas de comandos y se comprobó que todos los comandos de scope privado rechazan a un ciudadano antes de ejecutar.

No se atacó infraestructura de Discord, Roblox, PRC, ER:LC, GitHub ni la instalación del usuario. No se hicieron pruebas de agotamiento de memoria, DDoS, phishing, robo de sesiones reales ni pruebas con usuarios reales. La evidencia de dimensiones usa un PNG válido de 8000 × 1 píxeles y menos de 1 KB, no una bomba de descompresión de gran tamaño.

## Vulnerabilidades reproducidas y corregidas

| ID | Gravedad | Condición y resultado anterior | Corrección |
| --- | --- | --- | --- |
| SEC-01 | Alta | Una sesión policial sin permiso de staff recibía HTTP 200 al pedir por su nombre conocido una transcripción privada en `/uploads/`. Tener rol policial concedía acceso a todos los archivos antes de comprobar la propiedad del ticket. | Las transcripciones se autorizan por propietario del ticket, staff o administración. El caso recibe 403; las evidencias policiales conservan su acceso autorizado. |
| SEC-02 | Alta | Una sesión administrativa seguía recibiendo 200 después de retirar sus roles en el proveedor simulado y avanzar el reloj 31 segundos. Los roles podían quedar vigentes durante las ocho horas de sesión. | Se consulta de nuevo la pertenencia y los roles de Discord: antes de escrituras, y con caché máxima de 30 segundos para lecturas. Retirar el rol produce 403; perder la pertenencia o recibir un token inválido invalida la sesión. Si el proveedor no permite verificar, se deniega temporalmente con 503. |
| SEC-03 | Media | Login, nuevo login en el mismo navegador y logout de la nueva sesión dejaban la cookie anterior funcionando (200). Era aprovechable si alguien ya poseía esa cookie anterior. | El login elimina la sesión previa de ese navegador antes de emitir otra. El token anterior ahora recibe 401. No equivale a cerrar automáticamente sesiones de otros dispositivos. |
| SEC-04 | Media | Una evidencia diminuta en bytes pero con 8000 píxeles de ancho era aceptada con 200. Limitar a 5 MB no limitaba el trabajo de descompresión y renderizado. | Se comprueban dimensiones antes de incrustar la imagen: máximo 6000 px por lado y 10 millones de píxeles. La prueba recibe 400. Además, la web admite como máximo dos operaciones de documentos simultáneas y 30 por minuto por cuenta. No se provocó un agotamiento real para demostrarlo. |

Los cuatro casos anteriores fallaron como pruebas de seguridad antes de la corrección y pasan después. Sus condiciones de explotación son distintas: no permiten afirmar que una persona anónima pudiera obtener administración sin credenciales.

## Otros fallos y endurecimiento

- **Disponibilidad:** la contraseña local se calculaba con `scryptSync`, bloqueando el proceso web. Ahora se comprueba de forma asíncrona con un máximo de cuatro cálculos simultáneos. Se mantienen los diez fallos de contraseña por 15 minutos y se corrige la renovación de esa ventana. También se limita el total de solicitudes de login.
- **Estado en memoria:** límites de 5000 sesiones y 2000 flujos OAuth pendientes, con limpieza de expirados. Los contadores de rate limit también tienen un número máximo de claves. La prueba de creación repetida de OAuth obtiene 429, en lugar de admitir nuevas entradas ilimitadamente.
- **Límites HTTP:** 30 solicitudes de login por IP en 15 minutos, 30 inicios OAuth por IP/minuto y 300 solicitudes API por IP/minuto. La escucha de producción limita a 30 segundos la recepción de solicitudes y 15 segundos la recepción de encabezados. Estos límites reducen abuso; no sustituyen protección de infraestructura contra DDoS.
- **Idempotencia:** el identificador temporal estaba compartido entre multa y arresto. Ahora incluye el tipo de operación; una prueba usa el mismo ID para ambos y obtiene dos registros del tipo correcto. No era una escalada de permisos, pero sí un riesgo de integridad para un oficial autenticado.
- **Vinculación Roblox:** el callback exige una sesión autenticada y que coincida exactamente con la que inició el flujo. Poseer el `state` y su cookie desde otra sesión no basta. No se demostró una forma de obtener ese state de otro usuario; esta es una barrera adicional contra uso cruzado del flujo.
- **OAuth:** los estados se consumen después de validar la cookie y el proveedor, no antes. Se comprueba que un intento con cookie incorrecta no inutilice el flujo legítimo y que el código/state no pueda reutilizarse.
- **Cookies y transporte:** en una configuración HTTPS tanto la sesión como el estado OAuth usan Secure. Se añade HSTS para esa configuración, sin imponer políticas sobre subdominios ajenos.
- **Privacidad:** los tokens de acceso OAuth necesarios para comprobar los roles se conservan solo en los metadatos privados de la sesión en memoria, nunca dentro del objeto de usuario devuelto por la API. No se guardan en la base de datos ni se incluyen en las pruebas o el informe.

## Controles comprobados sin encontrar un bypass

- Anónimo: PDF privado devuelve 401. Ciudadano distinto: 403. Propietario: 200.
- Ciudadano: no puede escribir la configuración del bot ni crear ciudadanos administrativos.
- JWT con firma alterada: 401.
- Petición de escritura desde un origen externo aun con cookie válida: 403.
- Traversal codificado en rutas de documentos o recursos no entrega archivos privados.
- Texto de búsqueda con apariencia de SQL se trata como texto; no amplía resultados.
- Los comandos de scope privado rechazan a un contexto sin permisos antes de llamar a sus acciones. Las consultas de identidad públicas contienen su comprobación de propiedad o rol policial.
- El código del navegador revisado utiliza creación de nodos/texto para los datos; no se encontraron llamadas a `innerHTML`, `eval` o `new Function` en los módulos JavaScript revisados. Esto no demuestra ausencia universal de XSS.
- `npm audit`, tanto completo como de producción, reportó cero vulnerabilidades conocidas en el lockfile de esta revisión. Puede cambiar al publicarse nuevos avisos.
- No se versionan `.env`, bases SQLite, carpetas de datos ni PDFs de usuarios. Un barrido de patrones de tokens GitHub/Discord y claves privadas sobre los archivos versionados no produjo coincidencias. No es una certificación de ausencia de secretos ni un barrido completo del historial remoto.

## Condiciones y riesgos que siguen importando

1. **HTTPS antes de abrir acceso público.** Usar HTTP fuera de loopback puede exponer credenciales y contenido en tránsito. Configurar `BASE_URL=https://...`, terminación TLS y firewall. El valor por defecto sigue siendo localhost; no se ha publicado la web.
2. **Una cuenta de administrador o equipo comprometidos siguen siendo graves.** Contraseña única y larga; MFA en Discord y GitHub; permisos mínimos del bot. Una cuenta autorizada puede realizar sus operaciones legítimas. El comando de eliminación de canales sigue existiendo, exige dueño y confirmación; conviene restringirlo en producción según la necesidad del servidor.
3. **Revocación y disponibilidad externa.** Las lecturas pueden conservar permisos hasta 30 segundos; las escrituras revalidan. La verificación depende de Discord. Sus fallos o límites pueden causar 503 y requieren reintentar. No se ha validado la conexión con una cuenta real en esta auditoría.
4. **Limitación por IP detrás de proxy.** Sin configurar un proxy de confianza específico, varios usuarios pueden compartir el mismo contador. No confiar ciegamente en `X-Forwarded-For`; aplicar límites también en un proxy controlado. Los límites en memoria son por proceso y se reinician al reiniciar la aplicación.
5. **Archivos ya enviados a Discord o descargados no pueden revocarse con esta actualización.** Revisar permisos de canales y enlaces compartidos; los cambios de acceso web no retiran copias anteriores.
6. **Retención y respaldos.** Proteger copias `.runtime`, documentos y base de datos, minimizar información personal real y definir cuánto tiempo se conserva. No se borró ningún historial para imponer una política no acordada.
7. **Actualizaciones.** Mantener Node LTS, sistema operativo y dependencias en versiones con parches vigentes. Los mínimos de `engines` describen compatibilidad, no una recomendación de permanecer en una versión antigua.
8. **Cobertura limitada.** No se realizaron pruebas de carga de producción, análisis de infraestructura, todas las interacciones posibles de los 78 comandos ni auditoría completa de dependencias nativas. Un escaneo no permite garantizar que no quede ningún fallo.

## Aplicación

Actualizar y arrancar con los comandos habituales. La actualización conserva configuración, datos y respaldos. Las sesiones de la aplicación se pierden al reiniciar y los usuarios deben iniciar sesión otra vez; los nuevos permisos se aplican a esas sesiones.
