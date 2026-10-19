# Demostración comercial aislada de Maes RP

`/demo/maes`, `/demo/maes/ciudadano` y `/demo/maes/policia` sirven el mismo documento público `public/demo-maes.html`. El servidor debe resolver estas rutas **sin añadirlas a excepciones de autorización de API**. Las páginas privadas y todas sus comprobaciones de permisos permanecen separadas.

La demo no realiza peticiones de datos, no inicia OAuth, no usa cookies ni almacenamiento del navegador, y no importa código administrativo, del bot ni del almacén de producción. Solo se solicitan sus CSS, JavaScript y fuentes locales. Las interacciones ocurren dentro de una variable privada de la página y se pierden al recargar. Cambiar Ciudadano/Policía mediante los enlaces de la demo conserva el escenario durante la misma navegación; abrir otra pestaña empieza otro escenario.

Perspectivas incluidas:

- Ciudadano: perfil, cédula ficticia imprimible, vehículos, licencias con solicitud simulada, expediente, avisos vinculados al registro exacto, conversaciones ficticias y economía ilustrativa.
- Policía: búsqueda sobre dos personajes inventados, expediente, previsualización y emisión local de multas/arrestos, rectificación o anulación con historial, casos agrupados, avisos de pago/renovaciones pendientes e historial de la sesión.
- Ejemplo de recorrido comercial: Policía → Nueva multa → previsualizar → confirmar → Ciudadano → Avisos → abrir actuación → simular aviso de pago → Policía → Pendientes → validar. No se genera ningún PDF ni se efectúa un pago real.

La cédula tiene marcas permanentes «DEMO», «DATOS FICTICIOS» y «SIN VALIDEZ». El botón de impresión abre el diálogo del navegador, conserva las marcas y no invoca la generación de documentos real. Todos los importes y artículos están inventados para mostrar interacciones; no representan legislación ni tarifas.

Límites locales: 50 actuaciones, 50 movimientos, 20 casos, 10 consultas, 32 mensajes por consulta y 100 eventos de historial. Los importes monetarios son enteros entre 1 y 100 000; los movimientos no pueden exceder el saldo ficticio. Las confirmaciones de emisión y de pago son idempotentes dentro del escenario. No se admiten adjuntos ni evidencias reales.

Se usan las fuentes locales Space Grotesk y Syncopate, negro/rojo/blanco, contraste y estilo Maes. Navegación por teclado, foco visible, retorno de foco de diálogos, diseño móvil y `prefers-reduced-motion`. El usuario debe recibir siempre el aviso de no introducir datos personales.

Prueba de regresión: `node --test test/demo-maes.test.js`. Verifica independencia de la red, ausencia de almacenamiento, recorrido de multa/pago, validación, contenido tratado como texto, saldos, reset, licencias y casos.
