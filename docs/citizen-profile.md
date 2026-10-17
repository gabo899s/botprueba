# Perfil ciudadano y correcciones

El acceso continúa siendo exclusivamente Discord. «Actualizar foto de perfil» consulta a Discord usando el token guardado en el servidor y actualiza nombre e imagen; nunca admite una URL de avatar ni una identidad enviada por el navegador. Hay una pausa de 30 segundos por cuenta. Se comprueba de nuevo que la sesión siga abierta después de las consultas al proveedor. No modifica roles ni amplía los permisos.

El enlace Roblox inicia la vinculación OAuth existente, con retorno al panel ciudadano; requiere configurar la aplicación Roblox. No acepta un nombre escrito como prueba de propiedad de la cuenta.

El ciudadano puede enviar una solicitud de corrección de los datos **ficticios del personaje**: nombre, apellidos, nacimiento, nacionalidad, sexo, estatura, provincia y grupo sanguíneo. No permite cambiar el propietario Discord, número de cédula, cuenta Roblox, permisos, saldos o expedientes. Una solicitud pendiente por cuenta y un minuto entre envíos. Se conserva historial y respuesta de administración en `profileCorrections`, dentro del almacén privado existente.

Solo administración puede revisar solicitudes en el panel de staff. Se muestran los valores anteriores y propuestos. No es posible revisar la solicitud propia, revisar dos veces ni aprobar una solicitud si el personaje se ha modificado, eliminado o cambiado de propietario. La aprobación y su auditoría son una transacción: ante un error no se aplican cambios parciales. El rechazo requiere una explicación. La actualización de la cédula conserva la invalidación de PDF existente.

Los expedientes operativos siguen siendo legibles para el administrador del servidor. Esta función no promete cifrado de extremo a extremo ni requiere datos personales reales.

## Integración

`mountCitizenProfile(app, { auth, wrap, sessions, remote, renewDiscordToken, publicUser, assertSession })` monta las rutas. El almacén necesita `profileCorrections: []`. El script `citizen-profile.js` usa el evento `citizen:updated` y `window.CitizenApp`; en staff consulta su sesión con los mismos controles de administración del servidor. Los contenedores son `profileCorrections`, `profileCorrectionReviews`, `discordRefresh` y `robloxRefresh`.
