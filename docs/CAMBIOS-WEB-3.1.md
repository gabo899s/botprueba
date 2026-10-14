# Cambios web 3.1

- /: HTML del portfolio adjunto, con CSS creado para él, Poppins local, iconos locales y eventos en archivo JavaScript para respetar CSP. Se conserva el contenido del portfolio; el logo InfiniteDev usa un monograma nuevo porque el archivo no incluía su logo. Los avatares ausentes usan un recurso local neutro.
- Productos digitales: una opción, Sistema Completo para Rolplay, hacia /maes-rp.
- /maes-rp: portada previa de Maes RP, con sus funciones y una navegación hacia el panel ciudadano y el portfolio. OAuth regresa aquí por defecto.
- /ciudadano: cabecera, cuadrícula de doce accesos, tarjetas de datos personales/balance/cuentas y cédula visual, siguiendo las capturas y el negro, rojo y blanco de Maes RP.
- Perfil, cédula y multas abren sus secciones. Las demás tarjetas y acciones sin backend no cambian datos ni muestran resultados falsos. Las consultas de vehículos/licencias, tickets, sanciones y apelaciones se conservan.
- Sin sesión: ejemplo visual sin acceso a datos reales. Con sesión: los datos siguen viniendo de las API originales. No se cambió la autorización de las API.
- Asistente del portfolio: conserva notas al volver, limpia funciones al cambiar categoría, evita interpolar texto de usuario en HTML y restaura la acción Siguiente. Dialog con foco y Escape nativos.
- CSS responsive con cuadrícula de seis/tres columnas y perfil de dos/una columnas.

Validación: 64 pruebas automatizadas aprobadas. Incluyen los comandos anteriores, API y DOM de la web, menú de productos, navegación del asistente, vista pública y botones sin acción, y pago real autenticado. No se hizo una revisión visual automatizada en navegador.
