# Revisión de arranque, acceso y compatibilidad

Se contrastaron los seis hallazgos reportados con main en ce3057e.

| Hallazgo | Resultado y cambio |
| --- | --- |
| Falta bot/settings.js | El módulo sí está versionado. Se conserva y se comprueba su carga. |
| configured() invertida | Ya devolvía true cuando estaban ambas variables. Se expresa con Boolean y se comprueban las cuatro combinaciones. |
| result global en store.update | Ya estaba declarado dentro de un const múltiple. Se separan las declaraciones y se comprueba que no aparece ninguna variable global. |
| Sesión o infostaff nulos | Se añaden rechazos 401 antes de construir el actor y se normalizan las colecciones administrativas nulas. Las rutas siguen exigiendo sesión y permisos. |
| Inicio del bot sin catch | Se capturan fallos, se limpian recursos y se comunica código de salida 1. También se captura la limpieza fallida y la parada por señales. |
| Node y hostname | Se admite Node 22.13+ de la rama 22 y Node 24+. El instalador reconoce esas versiones. Node 20 carece de node:sqlite y la dependencia de voz exige al menos 22.12. El hostname de BASE_URL se admite, manteniendo la protección contra otros hosts. |

La web mantiene el acceso local predeterminado. LISTEN_HOST permite optar por escuchar en la red; BASE_URL determina su dirección pública, el origen autorizado y los retornos OAuth. Al configurar HTTPS, la cookie de sesión usa Secure. El asistente conserva una dirección pública y LISTEN_HOST existentes.

Las pruebas de Discord usan dobles de prueba; no implican una conexión real a Discord ni ER:LC.
