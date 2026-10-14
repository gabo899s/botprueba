# HTML recibido e integración

`pruebas (1).html` es la portada de MaesRP, no el panel policial. Contiene navegación, presentación, departamentos, pasos de acceso al juego, equipo administrativo y plantillas de perfil. El diseño original negro/rojo, las secciones, tipografías e iconos se conservaron.

## Problemas encontrados en el original

- Dependía del compilador Tailwind en CDN, FontAwesome y Google Fonts. La política de seguridad del servidor local bloqueaba scripts, estilos externos y eventos inline.
- Guardaba JWT en localStorage y los enviaba en URLs, incompatible con la sesión HttpOnly del proyecto local.
- No ofrecía el inicio de sesión local configurado en la terminal.
- Conservaba IDs de roles de otro servidor en el navegador.
- El logout solo borraba el token del navegador y no revocaba la sesión del servidor.
- El panel ciudadano dirigía a /ciudadano, una ruta no implementada.
- Exigía vincular Roblox con una ventana automática, aunque la vinculación es opcional y puede no estar disponible con HTTP localhost.
- Actualizar información solo mostraba un mensaje de función en desarrollo.
- El sistema de toast interpolaba texto en innerHTML: datos no confiables podían convertirse en HTML.
- Varias fotografías externas pueden dejar de cargar; TikTok e Instagram no tenían URLs configuradas.

## Cambios implementados

- Portada integrada como public/index.html; panel policial sigue en /v2/police.
- Tailwind compilado, fuentes e iconos incluidos localmente. No necesitas compilar CSS al instalar.
- JavaScript y CSS separados, sin eventos ni estilos inline, compatibles con CSP.
- Formulario local de acceso y Discord opcional; perfil y logout usan la sesión del servidor.
- Sin IDs de roles fijos: los permisos se obtienen del servidor según la configuración.
- Perfil ciudadano en un diálogo, consultando únicamente el personaje del usuario Discord. El administrador local tiene acceso al panel policial, no un personaje inventado.
- Un ciudadano sin rol policial puede abrir sus propios documentos; no consultar otros ciudadanos ni abrir documentos ajenos.
- Roblox opcional, sin ventana automática que bloquee el sitio. Actualizar información vuelve a consultar el servidor.
- Mensajes y nombres se insertan como texto, evitando interpretar contenido como HTML.
- Código del juego se copia al portapapeles; hay alternativa manual si el navegador lo bloquea.
- Los enlaces sociales vacíos informan que no están configurados. El Discord y el código de juego originales se conservaron.

## Comprobaciones

11 pruebas aprobadas: HTTP real del servidor, asistente y DOM de la portada con jsdom. Incluyen una sesión Discord simulada para comprobar permisos de ciudadano, acceso a documentos propios y rechazo de documentos ajenos. npm audit: 0 vulnerabilidades reportadas.

No se hizo una revisión visual automatizada en Chrome ni una autenticación real con tus cuentas Discord/Roblox. Las fotografías de terceros y avatares externos necesitan Internet. El acceso real al servidor de juego y la invitación Discord conservados no se verificaron.
