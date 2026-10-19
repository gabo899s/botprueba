# InfiniteDev y Maes RP · 3.12.0

Se conservan las funciones existentes y el flujo de actualización por GitHub. Maes utiliza negro, rojo y blanco con Space Grotesk y Syncopate locales; `maes-theme.css` unifica los paneles, administración, configuración y páginas de apoyo. InfiniteDev conserva su dirección azul/celeste y la animación metálica.

## Policía

- Web y Discord comparten `record-rules.js`: artículos del catálogo, cálculo cuando se omite monto, normalización de placa, vencimiento de siete días y límites coherentes. La web muestra catálogo y previsualización: al guardar por primera vez se presenta la revisión; la segunda confirmación emite el documento. Editar o cambiar ciudadano invalida esa revisión.
- Solicitudes repetidas conservan el registro; reutilizar la referencia con otros datos se rechaza. La sesión y el ciudadano se vuelven a comprobar después de generar PDF. Una cancelación elimina los documentos parciales, sin retirar archivos de un registro ya guardado.
- Mesa de operaciones en `/v2/police` y `/police-tools`: pendientes de validación, avisos fallidos, registros recientes, filtros y paginación.
- Rectificación/anulación motivadas por supervisión: requiere simultáneamente rol policial y administración, versión actual y motivo. No cambia titular ni autores. Conserva PDF original, versiones, supervisor y auditoría transaccional. Cobros inciertos o en curso bloquean cambios. El acceso a PDFs históricos deriva del registro actual canónico, nunca de un snapshot antiguo.
- Expedientes por incidente con lugar, fecha, narrativa, agentes, actuaciones y evidencias ya existentes. Se crean versiones de sus cambios; no se aceptan URLs de evidencia arbitrarias ni se habilitan nuevas subidas públicas.
- Confirmaciones manuales de pago no sobrescriben la primera referencia ni repiten la validación. La interfaz informa cuando el documento se guardó pero falló su notificación. La mesa consulta las colas actuales para distinguir fallo, reencolado y procesamiento; los reintentos y el estado del bot respetan la carpeta de datos configurada.

## Ciudadano

- Las notificaciones abren y resaltan el registro preciso, incluida la pestaña Arrestos.
- Patrimonio muestra vehículos y licencias con búsqueda, filtros y vigencia explícita. Renovar crea una solicitud; administración revisa, requiere fecha futura, detecta cambios del registro y no permite autorevisión. No se inventan vencimientos.
- Soporte conserva borradores en memoria al refrescar, mantiene conversación, carga mensajes anteriores y permite pausar el refresco de 15 segundos. No reenvía operaciones cuyo resultado no se pudo confirmar. Los borradores se borran al salir y no se guardan en el navegador.
- Se puede solicitar corregir lugar de nacimiento.
- Seguridad de cuenta: sesiones propias, navegador aproximado, fecha conocida, cierre individual o de otras sesiones. No devuelve SID, tokens, IP ni ubicación. Los metadatos se guardan con la sesión cifrada existente; sesiones antiguas pueden carecer de fecha de inicio. Desvincular Roblox exige confirmación y conserva personaje/expediente.

## Economía real y límites

Con `UNBELIEVABOT_TOKEN` y el servidor configurados se consulta cash/bank del proveedor existente UnbelievaBoat. Sin configuración o ante fallo se indica indisponibilidad, nunca un saldo supuesto.

El pago de una multa usa su importe canónico, referencia Maes, intención durable, historial y prevención de repetición. Si el proveedor no confirma un débito, la cuenta queda bloqueada para nuevos pagos hasta revisión. Solo supervisión con ambos permisos puede resolver el intento con referencia y evidencia, sin ejecutar otro débito ni revisar su propia operación. Los resultados confirmados se guardan aunque el navegador cierre sesión durante la respuesta.

Los comprobantes descargables son TXT privados del rol; la referencia Maes identifica nuestra solicitud, no es un ID de transacción emitido por el proveedor. El historial abarca pagos de multas registrados por Maes, no todos los movimientos externos.

**Depósito, retiro y transferencia permanecen deshabilitados:** el contrato actual no asegura una transacción atómica entre saldos/cuentas ni conciliación fiable en esos movimientos. La consulta de saldo es puntual y otras aplicaciones pueden gastar dinero fuera de Maes. No se promete atomicidad global del proveedor. Intentos antiguos sin identificador/monto requieren revisar el archivo original con personal técnico.

## Portafolio y demo

- El asistente valida todos los caminos al resumen, comunica fallos reales del portapapeles y descarga el pedido. El borrador se guarda solo mediante acción voluntaria, con restauración, borrado y caducidad; no se envía automáticamente a Discord.
- Trayectoria incorpora fichas y botones que preparan pedidos. El material o contexto que no está acreditado se deja pendiente; no se inventan métricas, testimonios ni capturas de clientes.
- La entrada conserva las tipografías y su duración, añade Omitir, espera de fuentes limitada, contenido sin JavaScript y pausa del efecto fuera del hero. Respeta movimiento reducido.
- `/demo/maes`, `/demo/maes/ciudadano` y `/demo/maes/policia` son públicas y muestran datos ficticios en memoria. Permiten explorar perfiles, registros, casos y operaciones simuladas etiquetadas, sin peticiones a las API reales, credenciales, cookies ni almacenamiento de datos reales. No cambian permisos de producción.

Tienda, viviendas, tradeos y otros módulos anteriormente señalados como futuros no se activan por esta entrega: no formaban parte de las doce mejoras acordadas.

## Actualizar

```bash
bash ~/botprueba/actualizar-linux.sh && bash ~/botprueba/iniciar-linux.sh
```

Abrir `http://localhost:3000` y, para la demo, `http://localhost:3000/demo/maes`. No se requiere configuración nueva para los módulos locales. Integraciones externas y acceso de usuarios reales siguen requiriendo las claves/roles y alojamiento correspondientes. No publiques `.env`, SQLite, PDFs, evidencias ni respaldos.

## Verificación

Se ejecutan pruebas automatizadas de dominio, rutas HTTP y DOM, incluyendo concurrencia, permisos separados, archivos históricos, sesiones, pagos inciertos, borradores, navegación y aislamiento de la demo. También se revisan Chromium escritorio/móvil y versiones Node admitidas. Las pruebas de Discord, Roblox, PRC y economía usan proveedores simulados; no se ejecutaron acciones en cuentas reales ni se procesó dinero real.

Resultados de esta entrega: 290 pruebas completas en Node 24 y 73 comprobaciones de las funciones nuevas en Node 22, todas correctas. Nueve vistas de Chromium en escritorio/móvil sin errores JavaScript ni desbordes. `npm audit --omit=dev` reportó cero vulnerabilidades conocidas en dependencias de producción al verificar la entrega; no es una garantía de ausencia de fallos.
