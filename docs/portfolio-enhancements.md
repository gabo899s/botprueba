# Portafolio: pedidos, referencias y presentación

## Pedido revisable

Todas las rutas al resumen —pasos, siguiente, modificar y acciones finales— comprueban las mismas reglas: los bots requieren al menos una función de su categoría y las webs/sistemas necesitan descripción. Cambiar de servicio conserva los datos en memoria. Copiar únicamente confirma éxito si el navegador o el mecanismo alternativo lo informa; si ambos fallan se ofrece seleccionar el texto o descargarlo. Descargar crea un `.txt` local y revoca la URL temporal. Abrir Discord sigue siendo una acción voluntaria: nada se envía automáticamente.

## Borrador opcional

`infinitedev.order-draft.v1` solo se escribe en localStorage al pulsar **Guardar borrador aquí**. No hay autoguardado, sincronización ni restauración automática. Contiene los campos visibles del pedido y caduca siete días después del guardado. **Restaurar** sustituye el pedido en memoria; **Borrar** elimina la copia persistida sin borrar el pedido abierto. Las acciones no envían contenido a un servidor.

El texto de privacidad, cookies y el propio asistente explican su alcance, caducidad y riesgo en navegadores compartidos. Se advierte no incluir contraseñas, tokens ni otros datos sensibles. El formato se valida, se limita el tamaño de texto y las categorías y funciones se reconstruyen desde listas conocidas. Los borradores corruptos o caducados se eliminan al abrir la página, inspeccionar disponibilidad o restaurar. Si no se vuelve a abrir el sitio, el navegador conserva físicamente los bytes hasta que se eliminen los datos del sitio, aunque la aplicación ya no los acepta transcurrido el plazo. Bloquear localStorage no impide preparar, copiar ni descargar un pedido.

## Trayectoria sin afirmaciones inventadas

Se conservan las cuatro referencias que ya estaban en el HTML del usuario: Escazu RP, Costa Rica Life, La Ruta RP y Maes RP. Las tres primeras muestran una ficha pendiente de completar, sin atribuir entregables, resultados, métricas ni imágenes no documentados. La ficha Maes RP enumera exclusivamente las funciones existentes del repositorio y enlaza a `/demo/maes`, con datos ficticios. Cada ficha permite comenzar un pedido de un servicio y comunidad preseleccionados; no lo envía.

El menú diferencia **Sistema Completo para Rolplay** (`/demo/maes`, demostración pública) de **Maes RP · comunidad** (`/maes-rp`, acceso real Discord). Metadatos de descripción y compartir describen el contenido sin inventar dominio canónico, imagen de compartir ni URL de producción.

## Entrada y rendimiento

Se conserva la composición del HTML aceptado: navbar flotante, hero azul/celeste, 21 fuentes únicas, aceleración, acabado metálico y vuelo de Infinitas; trayectoria integrada sobre negro y aura anclada al hero. No se modifica la identidad visual hacia rojo: ese tema corresponde a Maes RP.

**Omitir presentación** es accesible mediante teclado, libera los controles y coloca el foco en la marca. El contenido está desbloqueado de forma predeterminada sin JavaScript; el script solo aplica `inert` y bloqueo mientras reproduce la entrada. Un plazo de emergencia de 15 segundos libera el contenido si falla el ciclo posterior. Inter y la fuente metálica se precargan localmente; únicamente las fuentes primera/final tienen prioridad de arranque y se espera un máximo de 1,2 segundos. Las restantes se solicitan sin bloquear la navegación. Una fuente que no llegue usa su respaldo y no impide continuar.

El ciclo de reflejos metálicos y las animaciones CSS del aura se pausan cuando el hero deja de verse, y se reanudan al volver. Ocultar la pestaña libera una entrada pendiente; `prefers-reduced-motion` omite la secuencia y desactiva el aura animada. Se mantienen recursos locales y no se introducen manejadores inline ni relajaciones de CSP.

## Verificación

`node --test test/portfolio-enhancements.test.js test/aura.test.js test/portfolio-ui.test.js`

Pruebas de requisitos en todos los saltos, fallos de portapapeles, descarga local, consentimiento y expiración de borradores, datos corruptos/no confiables, almacenamiento bloqueado, escape HTML, fichas de referencias, fallback sin script, omisión/foco, fuentes bloqueadas, pausa fuera de pantalla y conservación de las 21 fuentes y composición.
