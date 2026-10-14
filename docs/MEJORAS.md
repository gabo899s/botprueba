# Mejoras y correcciones

Se mantienen los 61 comandos, 120 preguntas de licencia, 11 de whitelist, 34 artículos, páginas y formato Components V2 existente.

- El resultado de una licencia reprobada ya no muestra una etiqueta de whitelist.
- Los exámenes incluyen las opciones completas en el cuerpo del mensaje; el menú conserva los índices y añade numeración para distinguir respuestas largas.
- La comprobación de permisos admite managers, listas de IDs y objetos de rol sin fallar con managers incompletos.
- Los estados de turno se presentan en español sin cambiar su estado interno.
- El temporizador de mantenimiento se cancela al detener el bot y sus errores se capturan. El arranque duplicado no crea otro cliente; un login fallido libera el cliente para permitir reintentar.
- ER:LC rechaza comandos vacíos antes de efectuar llamadas a la API.

Validación: 37 pruebas aprobadas, incluida la suite anterior y 5 regresiones nuevas. Sintaxis JavaScript de los archivos modificados y scripts Bash comprobada. Sin pruebas de operaciones reales con credenciales del usuario.
