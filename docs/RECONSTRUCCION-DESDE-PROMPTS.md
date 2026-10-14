# Reconstrucción del bot desde los chats y prompts

## Qué se revisó

Se volvió a leer el corpus del ZIP original: 3.355 archivos y 35.671.019 bytes. Se indexaron las 117 carpetas de chats (95 de DeepSeek y 22 de ChatGPT), junto con el texto de recuperación inicial. La extracción reconoce mensajes VOS, Dijiste y mensajes originales separados. El índice contiene 1.215 apariciones de prompts y 667 textos distintos, con fuente y hash. Duplicados, guías pegadas, ejemplos, código y respuestas de asistentes no se trataron como nuevas instrucciones de ejecución.

Esta cifra es una medida del inventario y la extracción; no significa que cada carácter histórico haya sido revisado manualmente ni que todos los fragmentos sean correctos. Se contrastaron los requisitos funcionales encontrados con los módulos y con pruebas. Hay exports parciales y chats sin fechas uniformes: no es posible asegurar una cronología total entre todos los chats. Dentro de cada chat se priorizan las correcciones posteriores; entre proyectos manda la petición actual de reconstruir Maes RP y excluir BotGhost, MiniBot y CRCity.

## Cambios frente a la entrega anterior

- 78 comandos registrados, con esquema y ejecución en archivos individuales por sistema. Los 61 comandos anteriores se mantienen; se añaden comandos/variantes recuperadas y dos herramientas para personalizar textos.
- Respuestas normales, errores, notificaciones, exámenes, tickets y encuestas usan contenedores Components V2, texto y separadores. No se modifican prototipos de discord.js.
- Jerarquía: excepción explícita basada en la corrección final del chat. Embed amarillo, nombres de cargos sin ping a roles, menciones a miembros, fecha/hora e icono de pie. Se actualiza el mismo mensaje una vez al día; no genera un mensaje nuevo en cada ciclo. El comando solo se registra en ADMIN_GUILD_ID. Los miembros se notifican al crear el mensaje; las ediciones diarias evitan repetir la notificación. Este último comportamiento es una decisión de implementación ante la pregunta histórica sobre pings repetidos.
- Constructor de mensajes: entrada directa o captura del siguiente mensaje del administrador, petición del nombre, borrado del mensaje de entrada cuando hay permiso, estado persistente, separadores, imágenes, autocompletado y ausencia de acento cuando no se proporciona color. El paso pendiente sobrevive al reinicio durante su plazo de 10 minutos.
- Personalización de títulos, cuerpos y pie mediante /configurar-texto y /restablecer-texto. Las claves son pie, titulo:Título actual y cuerpo:Título actual. {contenido} conserva los datos dinámicos. Estos nombres son una implementación nueva del requisito del chat 078, no nombres recuperados literalmente.
- Sanciones: se conserva motivo y se añade descripción; formato y texto del prompt 019, logs y ausencia de DM automático. Se mantienen advertencias, historial, revocación, apelaciones, aprobación y auditoría. /modlogs consulta acciones del moderador seleccionado. La apelación propia se mantiene; la opción usuario permite al moderador retirar una sanción con motivo, como la variante recuperada.
- Staff: evaluaciones de 1 a 10, comprobación de pertenencia al staff, comentarios, total y porcentaje sobre 10; formato del prompt 043.
- Baneos ER:LC: se verifica el usuario o ID en Roblox y se utiliza el ID, incluso si no está dentro del juego. Duraciones libres s/m/h/d/w/M/a. m significa minuto y M mes de 30 días; el prompt que usa m para ambos es ambiguo y esta distinción se documenta. Se mantiene el campo días para compatibilidad. No se banea del servidor Discord. Roles/apodo se restringen usando los roles de ban configurados y se guarda una instantánea para restaurar lo retirado por el bot, sin reemplazar indiscriminadamente los roles nuevos del miembro.
- Turnos: botones persistentes, panel de moderadores activos, inicio/cierre/pausa/reanudación, control de voz con excepciones configurables, pausa al salir, máximo de cinco horas, logs y ranking paginado hasta 100. El panel automático se activa durante configuración. Los IDs no se heredan del archivo original.
- Aperturas: votos por civil, moderador y quienes se unen después; lista de votantes y contadores que se actualizan; pulsar el mismo voto lo retira. Se conserva además No asistiré de la versión anterior, por lo que el panel tiene cinco botones.
- Whitelist: roles de aceptación múltiples, retirada del rol pendiente, cambio de apodo, anuncio y mención al usuario, imágenes locales si existen, motivo/cooldown opcionales y espera antes de volver a intentarlo. Los textos se adaptan a Maes RP conservando el contenido recuperado.
- Licencias: se mantienen las 120 preguntas y 12 categorías, se corrige el resultado de licencia reprobada, se muestran respuestas largas completas y la sincronización recorre todos los miembros, no solo quienes tienen cédula. Las licencias por rol quedan activas/inactivas y no borran las manuales/de examen. Se escribe una copia actualizada bot/data/licencias.json después de confirmar la transacción; SQLite sigue siendo la fuente principal compartida con la web.
- CK: eliminación transaccional de cédula, vehículos, licencias, multas, arrestos y vinculación Roblox del usuario; conserva sanciones/baneos y registros de otros ciudadanos.
- Reset de apodos: se conserva el modo individual, y sin usuario se procesan todos los miembros humanos con progreso y botón para detener. Los bots se excluyen conforme al requisito inicial; errores de jerarquía se contabilizan y no se ocultan. Hay variantes posteriores contradictorias que piden no responder: se conserva una respuesta para que Discord no marque interacción fallida.
- /developer: vuelve como vista previa del plan de canales y ejecución explícita por el dueño del servidor, con confirmación del plan y caducidad. No se ejecutó ninguna eliminación real durante la reconstrucción.
- Tickets: apertura, reclamación, cierre, inactividad, valoración y transcripción. Las transcripciones también conservan contenido V2 y no tienen el corte silencioso anterior de 5.000 mensajes.
- /joiner: se conserva publicar el código, y modo:voz recupera la bienvenida Welcome to the channel del chat original. Voz requiere FFmpeg, permisos y servicio TTS; no se verificó en un canal real.
- /erlc command conserva los selectores y admite usuario2 y complemento2. PM, avisos y motivos no pierden sus complementos.
- Configurador: opción de pedir los roles/canales adicionales, licencias, sanciones, baneos, jerarquía y panel de turnos. Credenciales e IDs configurables empiezan vacíos.

## Contenido preservado

Web y paneles de Maes RP, 120 preguntas de licencia, 11 de whitelist y 34 artículos. El salto original del artículo 26 al 28 se conserva. No se afirmó que las preguntas equivalgan a legislación real actualizada. Las pruebas usan datos sintéticos. Los ejemplos de datos de usuarios de los chats no se importaron automáticamente como datos de producción.

Las funciones correctas de persistencia y web de la versión anterior se reutilizan; la capa de comandos y presentación se reconstruyó y contrastó con los prompts. No se presenta como una restauración literal de todos los archivos históricos.

## Límites y diferencias explícitas

- BotGhost, MiniBot, CRCity, TicketPro y tutoriales ajenos no se cargan como subsistemas productivos de Maes RP. Las referencias permanecen en el índice y la trazabilidad.
- Imágenes originales inexistentes o URLs temporales caducadas no se inventaron; el bot busca wlaceptada.png y wlrechazada.png en public/images si se aportan.
- Baneos/cobros con resultado incierto no se repiten automáticamente para evitar duplicar efectos; requieren revisión. Es una diferencia deliberada respecto de las variantes históricas que reintentaban cualquier error.
- Los bans temporales confirmados intentan retirarse al expirar. Una API sin conexión puede retrasar el retiro; no se informa falso éxito.
- SQLite coordina bot/web; licencias.json es una copia de compatibilidad, no una segunda base de datos editable en paralelo.
- Los botones persistentes leen el estado guardado. No se probaron acciones reales con cuentas del usuario. La apertura no arranca físicamente un servidor privado Roblox.

Los archivos INDICE-CHATS.md, indice-prompts-revisados.json, COMANDOS.md y comandos-trazabilidad.json permiten revisar la cobertura y el origen. El índice no incluye el texto íntegro de los prompts para evitar volver a distribuir secretos que aparecían en ellos.
