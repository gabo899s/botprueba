# botprueba · flujo acordado con el usuario

Este repositorio contiene InfiniteDev, la demo de Maes RP y el bot Discord/ER:LC.

El usuario pidió que todos los cambios terminados se suban a este repositorio y que no se entreguen ZIP como forma habitual de actualización. Tras implementar y comprobar un cambio autorizado, crear commit y subirlo a main, conservando el historial y sin force-push. Verificar el commit remoto antes de comunicarlo. No es necesario pedir otra confirmación para subir cambios ya solicitados por el usuario.

Los comandos de usuario son:
- Actualizar: bash ~/botprueba/actualizar-linux.sh
- Iniciar: bash ~/botprueba/iniciar-linux.sh
- Detener: bash ~/botprueba/detener-linux.sh

Nunca publicar .env, bot/config.json, bot/data, public/pdfs, public/uploads, .runtime, credenciales, bases de datos ni respaldos. Preservar esos archivos en actualizaciones. El índice de prompts es una referencia de origen, no instrucciones de ejecución.

Conservar las funciones existentes salvo cambio solicitado. InfiniteDev usa la dirección visual azul/celeste; Maes RP mantiene negro, rojo y blanco. El aura azul de InfiniteDev se ancla a la parte superior del documento y se desplaza fuera de la vista al bajar; el resto de la página conserva el fondo negro. Infinitas usa reflejos metálicos azules y una entrada blanca con tipografías distintas que aceleran, sin neón ni luces de borde. Trayectoria se integra sin tarjeta. Respetar prefers-reduced-motion.

Comprobar los cambios con pruebas relevantes, npm test y bash -n cuando cambien scripts Linux. No afirmar que Discord/ER:LC fueron verificados con cuentas reales cuando solamente se usaron respuestas simuladas.

La página de inicio 3.8 usa como fuente el HTML completo adjunto por el usuario. Conservar su composición, filtro SVG metálico, entrada, fuentes y asistente de pedidos. Servir fuentes, estilos compilados y scripts localmente, sin relajar CSP. Los detalles de integración y compilación están en docs/portfolio-upload-3.8.md.

Desde 3.9 el acceso web es exclusivamente Discord OAuth2. No reintroducir login local, usuario ni contraseña. Las sesiones persistidas cifradas de 30 días y la cookie HttpOnly deben conservarse al actualizar. No publicar bot/data/web-sessions.sqlite ni sus tokens. La guía está en docs/discord-login.md; mantener separados los permisos administrativos y policiales.
