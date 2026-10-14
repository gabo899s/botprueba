# InfiniteDev + Maes RP + bot Discord/ER:LC

Proyecto completo de `gabo899s/botprueba`. La portada es InfiniteDev; **Productos digitales → Sistema Completo para Rolplay** abre Maes RP. El panel ciudadano tiene la distribución de las referencias con el negro, rojo y blanco de Maes RP. Se mantienen los 78 comandos y las funciones previas.

## Instalar desde GitHub una sola vez

En Linux, detén cualquier versión anterior con **Ctrl+C** y ejecuta:

```bash
archivo="$(mktemp)" && curl -fsSL https://raw.githubusercontent.com/gabo899s/botprueba/main/instalar-github.sh -o "$archivo" && bash "$archivo"
```

El instalador clona en `~/botprueba`, instala Node compatible si hace falta y comprueba la aplicación. En Debian/Ubuntu/Chromebook instala los requisitos ausentes. Si encuentra una instalación previa conocida, recupera `.env`, roles, base de datos y documentos sin borrar la carpeta anterior. Si no hay configuración, abre el asistente una vez. La migración ocurre antes de iniciar; detén la versión anterior para que la base de datos no esté siendo escrita.

Una carpeta `~/botprueba` que no sea un repositorio se conserva con el sufijo `-anterior-fecha-hora`. No se descarga ningún ZIP.

## Comandos habituales

**Actualizar todo** — comprueba GitHub, respalda datos, instala dependencias, ejecuta pruebas y reinicia si la aplicación estaba encendida:

```bash
bash ~/botprueba/actualizar-linux.sh
```

**Iniciar web y bot** — queda en segundo plano y puedes cerrar la terminal:

```bash
bash ~/botprueba/iniciar-linux.sh
```

**Detener:**

```bash
bash ~/botprueba/detener-linux.sh
```

Abre **http://localhost:3000**. El puerto configurado en `.env` se conserva. `/maes-rp` es la demo y `/ciudadano` el panel del ciudadano.

**Ver registros:**

```bash
tail -f ~/botprueba/.runtime/app.log
```

**Cambiar configuración:**

```bash
bash ~/botprueba/detener-linux.sh && bash ~/botprueba/configurar-linux.sh && bash ~/botprueba/iniciar-linux.sh
```

## Qué se conserva al actualizar

`.env`, `bot/config.json`, `bot/data`, `public/pdfs`, `public/uploads` y `.runtime` son locales y están excluidos de Git. No se publican tokens ni datos reales. Los respaldos están en `.runtime/respaldo-*`. Si el código tiene cambios locales, el actualizador se detiene y los conserva; no usa reset ni force-push. Una actualización fallida no arranca código que no pasó las comprobaciones.

Los cambios futuros solicitados por el usuario se suben a este repositorio después de comprobarlos. La rama de instalación es `main`.

## Diseño y funciones

InfiniteDev tiene un aura azul/celeste que aparece desde negro. Se mueve lentamente hasta terminar la carga, desacelera y queda fija sin saltar de posición. `prefers-reduced-motion` muestra una versión estática. No requiere servicios externos de efectos ni bibliotecas de UI adicionales. Tipografías, iconos y recursos gráficos están incluidos localmente.

Maes RP conserva sus funciones y su identidad roja/blanca/negra. Los botones ciudadanos sin backend son intencionalmente inactivos. El banco no inventa saldos. Los visitantes sin sesión ven una demo sin acceder a datos reales.

Discord y ER:LC necesitan tus credenciales. Las imágenes locales ausentes no se inventaron; los mensajes pueden usar `public/images/wlaceptada.png` y `wlrechazada.png` si se aportan. La bienvenida por voz necesita FFmpeg y permisos Conectar/Hablar.

## Verificación y documentación

```bash
cd ~/botprueba && npm test
```

69 pruebas automatizadas: API, DOM, comandos, persistencia, aura y arranque/cierre de Linux; el actualizador se prueba con un remoto Git local y npm simulado. Auditoría productiva: cero vulnerabilidades reportadas al preparar esta versión. No se han ejecutado operaciones reales en cuentas Discord/ER:LC del usuario ni una revisión visual automatizada en navegador.

- `docs/RECONSTRUCCION-DESDE-PROMPTS.md`: origen y límites de la reconstrucción.
- `docs/INDICE-CHATS.md`: índice del material recuperado.
- `docs/COMANDOS.md`: comandos y sus fuentes.
- `docs/CAMBIOS-WEB-3.1.md`: adaptación del portfolio y perfil.

El archivo `docs/INSTALACION-ANTERIOR.md` conserva las instrucciones históricas de ZIP como referencia; para el uso actual sigue esta página.
