# Panel ciudadano · 3.11

Esta entrega completa los puntos 1, 3, 4, 5 y 7 solicitados. Conserva el portafolio, las funciones del bot, el estilo negro/rojo/blanco, las sesiones Discord persistentes y los controles de seguridad de 3.10.

## Perfil y cuenta

«Actualizar perfil de Discord» consulta nombre/foto al proveedor sin aceptar datos de identidad del navegador. Pausa de 30 segundos por cuenta. Roblox se vincula mediante OAuth y vuelve a `/ciudadano`; requiere la aplicación Roblox, sus credenciales y el callback `BASE_URL/auth/roblox/callback`. Se valida la identidad devuelta, se impide vincular una cuenta Roblox ya usada y se comprueba que la sesión siga vigente antes de guardar.

Las correcciones permiten únicamente datos ficticios del personaje. No cambian propietario, cédula, roles, dinero ni expediente. Administración revisa en `/staff`; un administrador no puede aprobarse a sí mismo. Un personaje cambiado desde la solicitud exige rechazarla y presentar otra. Véase [citizen-profile.md](citizen-profile.md).

## Expediente

Multas y arrestos tienen pestañas separadas, búsqueda, filtros de estado y fechas, detalles, PDF y evidencia autorizados. Los registros conservan su contenido y sus unidades originales; las cantidades son dinero ficticio del rol. Las apelaciones se envían con formulario y conservan el borrador si falla la petición. Una validación de pago solicitada no descuenta dinero ni marca la multa como pagada. Los cobros en proceso o sin confirmar requieren esperar o revisar con el personal.

## Notificaciones

Avisos derivados de registros propios: multas/arrestos, pagos confirmados, resolución de apelaciones y correcciones, tickets y vencimientos explícitos de licencias. No se inventan fechas de vencimiento ni se envían mensajes privados nuevos a Discord para generar avisos. Se muestran hasta 100 avisos, con un máximo de 500 eventos considerados de los últimos 90 días. El contador puede incluir avisos fuera de los 100 mostrados; «Marcar todas» los cubre.

`bot/data/citizen-notifications.sqlite` guarda únicamente identificadores de eventos y fechas de lectura por usuario, con permisos privados. Se conserva el estado al reiniciar. Los marcadores caducan a los 90 días y hay topes de almacenamiento. No se duplica el contenido del expediente. La copia individual de privacidad incluye los marcadores y las solicitudes propias de corrección; los respaldos antiguos requieren gestión separada por el operador.

## Soporte conectado a Discord

Cada ciudadano ve sus propios tickets incluso si su cuenta también tiene permisos de staff. Crear y responder requiere bot conectado, pertenencia al servidor y permisos en el canal privado de texto. La creación reutiliza los cupos y el límite de ticket abierto del bot. La consulta obtiene los últimos 50 mensajes de texto visibles al propietario; adjuntos, mensajes de otros bots, embeds, hilos y notas privadas no se presentan en la web. Las transcripciones conservan su ruta protegida existente.

Las respuestas desactivan menciones y guardan identificadores de solicitud para evitar duplicados. Un envío a Discord cuyo resultado no se puede confirmar queda pendiente de revisión; no se repite automáticamente. La interfaz informa del fallo y permite revisar el canal en Discord. Cupos por cuenta:30 lecturas/minuto,10 respuestas/minuto; concurrencia global 8 y 4 respectivamente. Máximo 1000 intenciones de respuesta web por ticket.

Los eventos de respuesta del staff mantienen una pausa de 15 segundos entre escrituras. Cerrar sesión o cambiar de cuenta limpia datos y borradores y descarta respuestas de consultas antiguas.

## Módulos pendientes y roles

Tienda, patrimonio, casa, transacciones, tradeos y CK mantienen sus botones con estado «Próximamente». No ejecutan compras, cambios de saldo ni eliminación de personajes.

El asistente `bash configurar-linux.sh` pregunta opcionalmente por estas listas de roles; se dejan vacías para ocultar los departamentos:

```dotenv
DOT_ROLE_IDS=
FIRE_ROLE_IDS=
GANG_ROLE_IDS=
```

Con un rol configurado y verificado por el servidor se muestra el departamento correspondiente como pendiente. El permiso administrativo no sustituye estos roles. No hay módulos departamentales operativos detrás de esos botones todavía. No necesitas rellenar estas variables para usar perfil, expediente, notificaciones y soporte.

## Comprobación

197 pruebas aprobadas en Node 24 y Node 22.13, de servicios, rutas y DOM con proveedores simulados, más comprobación integrada en Chromium de navegación, formularios, pagos, apelaciones, notificaciones, soporte, cierre de sesión y vista móvil. No se usaron cuentas reales de Discord/Roblox ni se enviaron mensajes reales a Discord durante las pruebas. No se añaden garantías de seguridad absoluta o de cifrado de extremo a extremo.
