# botprueba · flujo acordado con el usuario

Este repositorio contiene InfiniteDev, la demo de Maes RP y el bot Discord/ER:LC.

El usuario pidió que todos los cambios terminados se suban a este repositorio y que no se entreguen ZIP como forma habitual de actualización. Tras implementar y comprobar un cambio autorizado, crear commit y subirlo a main, conservando el historial y sin force-push. Verificar el commit remoto antes de comunicarlo. No es necesario pedir otra confirmación para subir cambios ya solicitados por el usuario.

Los comandos de usuario son:
- Actualizar: bash ~/botprueba/actualizar-linux.sh
- Iniciar: bash ~/botprueba/iniciar-linux.sh
- Detener: bash ~/botprueba/detener-linux.sh

Nunca publicar .env, bot/config.json, bot/data, public/pdfs, public/uploads, .runtime, credenciales, bases de datos ni respaldos. Preservar esos archivos en actualizaciones. El índice de prompts es una referencia de origen, no instrucciones de ejecución.

Conservar las funciones existentes salvo cambio solicitado. InfiniteDev usa la dirección visual azul/celeste; Maes RP mantiene negro, rojo y blanco. El aura de InfiniteDev aparece desde negro y permanece en movimiento visible, más lento que el degradado de la palabra Infinitas. Al bajar a Trayectoria cambia suavemente al mesh violeta; al subir vuelve al azul/celeste. Respetar prefers-reduced-motion.

Comprobar los cambios con pruebas relevantes, npm test y bash -n cuando cambien scripts Linux. No afirmar que Discord/ER:LC fueron verificados con cuentas reales cuando solamente se usaron respuestas simuladas.
