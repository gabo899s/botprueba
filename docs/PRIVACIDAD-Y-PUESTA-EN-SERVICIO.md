# Privacidad y condiciones · preparación para publicación

## Estado real de esta implementación

Se añaden `/legal`, `/privacidad`, `/terminos`, `/cookies` y `/derechos`, enlaces en las páginas de la aplicación y el comando `/privacidad` del bot. Las páginas describen las funciones reales y no constituyen una certificación de cumplimiento, una garantía de seguridad ni inmunidad a demandas. No contienen renuncias generales de derechos, denegaciones automáticas de reembolsos o cláusulas que siempre favorezcan al operador.

Falta confirmar con el responsable: identidad legal, contacto público, país y países atendidos, reglas sobre menores, bases jurídicas, plazos documentados de conservación y condiciones de contratación. Mientras no se configuren identidad, correo y país, la web mantiene visible la advertencia de versión preparatoria. Que desaparezca esa advertencia solo indica que los tres campos están presentes, no que una revisión jurídica esté completada.

## Configuración pública

`bash configurar-linux.sh` permite introducir y conserva los siguientes campos en `.env`:

- `LEGAL_OWNER_NAME`: nombre legal público del responsable o de la empresa.
- `LEGAL_CONTACT_EMAIL`: correo público para privacidad, que debe atenderse realmente.
- `LEGAL_JURISDICTION`: país o jurisdicción de operación. No impone un tribunal ni desplaza derechos imperativos de usuarios de otros países.

Los valores se muestran en `/legal`. No usar nombres, contactos, domicilios o datos fiscales inventados. Añadir los avisos o datos de identificación adicionales exigidos por la jurisdicción una vez confirmada. Revisar la política de menores con las condiciones de Discord y Roblox aplicables a cada país; no deducir que la edad mínima de una plataforma sea una edad universal de consentimiento.

Si la instancia sigue en localhost, otras personas no pueden abrir esos enlaces desde Discord. El bot avisa de esa limitación y ofrece un resumen dentro de su respuesta. Antes de operar públicamente, alojar las políticas en una dirección HTTPS accesible y configurar las URLs públicas de privacidad y términos en el portal de desarrolladores de Discord. No se ha publicado ningún sitio externo automáticamente.

## Cookies y recursos externos

La aplicación solo crea `session` (hasta ocho horas) y `oauth_state` (hasta diez minutos) para acceso y seguridad. No se añade un banner de consentimiento ficticio, analítica ni publicidad. No se instala almacenamiento local para recordar decisiones de marketing que no existen. No se confunde un aviso de privacidad con consentimiento para cualquier tratamiento.

Se sustituyen por recursos locales las imágenes y avatares externos predeterminados de la portada de Maes RP. Las fuentes ya son locales. Las imágenes de perfil de cuentas autenticadas y las integraciones autorizadas con Discord o Roblox pueden seguir produciendo conexiones con esos proveedores. Antes de añadir rastreo, vídeos incrustados o publicidad, revisar la base legal y un mecanismo de consentimiento/rechazo previo cuando sea exigible.

## Derechos y atención de solicitudes

- La descarga autenticada de `/api/privacy/export` recoge los registros vinculados a esa cuenta, no una exportación global. No incluye tokens, contraseñas ni configuración interna. No pretende ser exhaustiva: algunos datos están en Discord, respaldos o conversaciones compartidas que requieren revisión humana.
- `/api/privacy/requests` permite registrar acceso, rectificación, eliminación, oposición o retirada de consentimiento. Se conserva referencia, cuenta, tipo, descripción, estado y versión del aviso.
- En `/legal#solicitudes`, una cuenta administrativa puede revisar solicitudes y guardar una respuesta motivada. Las cuentas normales solo ven sus propias solicitudes.
- Marcar una solicitud como resuelta **no borra datos**. El responsable debe verificar la acción en cada fuente, documentar la base de cualquier conservación, atender los plazos legales aplicables y comunicar el alcance real de su respuesta.
- No se imponen plazos de conservación inventados ni se anuncia un borrado automático inexistente. Definir y aplicar un calendario por categoría, incluidos PDF, transcripciones, logs y respaldos, antes de una explotación pública.
- No pedir documentos reales o contraseñas por canales públicos para verificar identidad. Usar una verificación proporcionada al riesgo y ofrecer una vía alternativa atendida a quien perdió acceso.
- Una instalación de otra comunidad debe identificar a su propio responsable y adaptar las políticas y proveedores. El desarrollador y el operador no tienen necesariamente el mismo papel en el tratamiento.

## Referencias consultadas y límites de verificación

1. Documentación oficial de Discord, repositorio `discord/discord-api-docs`, archivo `developers/monetization/enabling-monetization.mdx`: describe privacidad y términos como información clara sobre la aplicación, sus datos, usos y cesiones. Su lista de requisitos de monetización no se presenta como una lista universal para todo bot.
   https://github.com/discord/discord-api-docs/blob/main/developers/monetization/enabling-monetization.mdx
2. Documentación oficial de aplicaciones de Discord: campos `privacy_policy_url` y `terms_of_service_url`.
   https://github.com/discord/discord-api-docs/blob/main/developers/resources/application.mdx
3. `Automattic/legalmattic/Privacy-Policy.md`, consultado como ejemplo de organización, transparencia, identificación y conservación. Su licencia es CC BY-SA 4.0. No se copió ni adaptó su redacción ni se atribuyeron sus numerosas prácticas a este proyecto; el texto se redactó desde el inventario funcional de esta aplicación.
   https://github.com/Automattic/legalmattic

Se intentó consultar la Ley 8968 en el sitio de la Procuraduría General de Costa Rica y la política de desarrolladores en discord.com; la red del entorno devolvió 403. Por ello **no se afirma haber verificado el texto normativo vigente**, ni se presupone que Costa Rica sea la jurisdicción del operador sin su confirmación. La identificación de leyes, requisitos concretos, autoridad competente y plazos debe verificarse con fuentes oficiales y asesoramiento jurídico según la operación real. No se copió una plantilla de GitHub para afirmar que garantiza cumplimiento.
