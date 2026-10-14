# Versión 3.2.0

- Proyecto completo alojado en gabo899s/botprueba, rama main.
- Actualizaciones con git fast-forward, respaldo de configuración/datos, instalación comprobada y reinicio de la aplicación cuando estaba encendida.
- Instalación inicial desde GitHub con migración de carpetas anteriores; no necesita volver a rellenar los secretos si existe una configuración válida.
- Inicio en segundo plano, comprobación de puerto/estado, control de PID y parada ordenada.
- No se cierra ningún proceso ajeno al proyecto. Los descriptores de locks se cierran antes de lanzar el proceso persistente para no bloquear futuras actualizaciones.
- Aura CSS azul, celeste y luz helada detrás del portfolio. Aparece gradualmente desde negro; al finalizar la carga y un mínimo de exposición, desacelera durante 1,8 segundos y se pausa en su posición actual.
- Movimiento reducido respetado. La página y el menú de productos permanecen disponibles durante el efecto.
- Maes RP y el bot mantienen sus funciones y diseño propios.

Verificación: 69 pruebas aprobadas y auditoría productiva con 0 vulnerabilidades reportadas. Los scripts Bash pasan bash -n. No se usaron credenciales reales de Discord/ER:LC en pruebas.
