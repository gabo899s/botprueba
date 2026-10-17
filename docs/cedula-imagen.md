# Cédula de personaje en imagen · 3.11.1

`/registrar-cedula` y `/ver-cedula` muestran una imagen PNG de 1080 × 690 dentro de una galería de Components V2 en la respuesta privada de Discord. Conservan también el PDF adjunto. `/cedula-prueba` usa la misma consulta. Los esquemas se actualizan al reiniciar el bot.

El diseño toma la distribución de la referencia: fotografía a la izquierda, datos y número a la derecha, fondo de líneas, firma tipográfica y distintivo de Maes RP. Se identifica como documento de ficción sin validez legal. La firma es el nombre del personaje en cursiva, no una firma manuscrita verificada. No se inventan fechas: expedición usa el registro original y vencimiento muestra «No establecido» si no existe. La nacionalidad y los demás valores proceden del registro, no de los datos del ejemplo.

El registro admite ahora `grupo-sanguineo` y `lugar-nacimiento`, opcionales. Las cédulas existentes funcionan sin registrarlas otra vez. El lugar usa la provincia como alternativa si no está consignado. Los valores ausentes se indican expresamente.

El avatar usa la imagen de Roblox vinculada o consulta la miniatura pública por el usuario Roblox indicado. Esta consulta no vincula ni verifica propiedad de cuentas. Si falla o Roblox devuelve una miniatura pendiente, se usa una silueta y se puede reintentar después de 30 segundos. La consulta no utiliza datos de la foto de referencia del usuario.

En `/ciudadano`, «Mi Cédula» muestra la misma imagen y permite descargarla. `/api/profile/identity.png` requiere la sesión Discord del propietario, ignora identificadores de terceros y revalida sesión y titularidad después de generar. La respuesta es privada y no se almacena en la caché del navegador. Los PNG no se escriben en carpetas públicas: solo existe una caché en memoria de hasta 16 tarjetas durante cinco minutos (30 segundos cuando falta la foto). Actualizar datos cambia su huella. El generador Discord vuelve a verificar el registro antes de adjuntarlo.

Las descargas remotas usan HTTPS y dominios Roblox permitidos, no siguen redirecciones, tienen límite de seis segundos, dos MiB y diez megapíxeles; solo se decodifican PNG/JPEG/WebP. Los textos se escapan antes de dibujar. La generación web y Discord respeta los límites de trabajo de documentos existentes.

Actualización habitual:

```bash
bash ~/botprueba/actualizar-linux.sh && bash ~/botprueba/iniciar-linux.sh
```

Pruebas locales: generador PNG, avatar simulado, límites de entrada, presentación Discord V2, autorización HTTP, cambio de titular y cierre de sesión durante generación. Esto no sustituye una prueba con el bot conectado a una cuenta real de Discord.
