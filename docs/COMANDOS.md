# Comandos y trazabilidad de la reconstrucción

Cada comando tiene esquema y ejecución en `bot/commands/<sistema>/<comando>.js`. El cargador recorre esas carpetas y rechaza nombres duplicados.

| Comando | Acceso | Fuente recuperada o motivo |
|---|---|---|
| /activar-shift | staff | DeepSeek/codigo_generado/058_Sistema_anti-farming_y_ranking_de_moderadores/m006_b001_shifts.js |
| /apagar-shift | staff | DeepSeek/codigo_generado/058_Sistema_anti-farming_y_ranking_de_moderadores/m006_b001_shifts.js |
| /pausar-shift | staff | Compatibilidad de la versión previa o implementación del requisito de configuración/persistencia. |
| /ranking | staff | DeepSeek/codigo_generado/058_Sistema_anti-farming_y_ranking_de_moderadores/m006_b001_shifts.js |
| /reanudar-shift | staff | Compatibilidad de la versión previa o implementación del requisito de configuración/persistencia. |
| /aperturas | staff | DeepSeek/codigo_generado/044_Updated_Whitelist_Script_with_Complete_Code/m002_b004_aperturas.js |
| /encuesta-apertura | staff | codigo/Analisis_de_archivo_completo/aperturas_v001.js |
| /estado-server | staff | Compatibilidad de la versión previa o implementación del requisito de configuración/persistencia. |
| /estado-sv | staff | codigo/Analisis_de_archivo_completo/aperturas_v001.js |
| /server | staff | DeepSeek/codigo_generado/053_Guia_de_componentes_V2_de_Discord.js/m006_b002_server.js |
| /arrestar | police | codigo/Licencias_js_adaptado_CR/arrestar_v001.js |
| /ver-arrestos | public | DeepSeek/codigo_generado/030_Error_en_pago_de_multas_corregido/m006_b002_arrestos.js |
| /banear | moderator | DeepSeek/codigo_generado/032_Analisis_de_migracion_a_Components_V2/m006_b008_baneos.js |
| /desbanear | moderator | DeepSeek/codigo_generado/032_Analisis_de_migracion_a_Components_V2/m006_b008_baneos.js |
| /ver-baneo | moderator | DeepSeek/codigo_generado/032_Analisis_de_migracion_a_Components_V2/m006_b008_baneos.js |
| /cedula-prueba | admin | codigo/Revisar_y_corregir_codigo/cedula-prueba_v001.js |
| /ck | admin | DeepSeek/codigo_generado/030_Error_en_pago_de_multas_corregido/m008_b001_bloque.txt |
| /eliminar-cedula | admin | codigo/Licencias_js_adaptado_CR/cedulas_v001.js |
| /info-cedula | public | DeepSeek/codigo_generado/060_Analisis_y_cambios_en_archivo_aperturas.js/m024_b001_cedulas.js |
| /registrar-cedula | public | codigo/Licencias_js_adaptado_CR/cedulas_v001.js |
| /ver-cedula | public | codigo/Licencias_js_adaptado_CR/cedulas_v001.js |
| /revisar-licencias | staff | DeepSeek/codigo_generado/095_Analisis_y_mejora_de_bot_Discord/m004_b002_licencias.js |
| /solicitar-licencia | public | codigo/Licencias_js_adaptado_CR/licencias_v001.js |
| /ver-licencias | public | DeepSeek/codigo_generado/029_Revision_de_sistema_bot_y_comandos_Discord/m006_b001_licencias.js |
| /configurar-texto | admin | Compatibilidad de la versión previa o implementación del requisito de configuración/persistencia. |
| /crear-mensaje | admin | DeepSeek/codigo_generado/028_Desarrollo_de_sistema_de_mensajes_avanzado/m004_b005_crear-mensaje.js |
| /editar-mensaje | admin | DeepSeek/codigo_generado/028_Desarrollo_de_sistema_de_mensajes_avanzado/m008_b001_mensajes.js |
| /eliminar-mensaje | admin | DeepSeek/codigo_generado/028_Desarrollo_de_sistema_de_mensajes_avanzado/m008_b001_mensajes.js |
| /enviar-mensaje | admin | DeepSeek/codigo_generado/028_Desarrollo_de_sistema_de_mensajes_avanzado/m008_b001_mensajes.js |
| /listar-mensajes | admin | DeepSeek/codigo_generado/028_Desarrollo_de_sistema_de_mensajes_avanzado/m008_b001_mensajes.js |
| /restablecer-texto | admin | Compatibilidad de la versión previa o implementación del requisito de configuración/persistencia. |
| /multar | police | codigo/Licencias_js_adaptado_CR/multas_v002.js |
| /multas | public | DeepSeek/codigo_generado/037_Correccion_de_errores_en_multas.js/m006_b012_multas.js |
| /pagar-multa | public | codigo/Licencias_js_adaptado_CR/multas_v002.js |
| /revisar-multas | police | DeepSeek/codigo_generado/031_este_es_mi_index.js/m004_b001_multas.js |
| /ver-multas | public | DeepSeek/codigo_generado/030_Error_en_pago_de_multas_corregido/m004_b001_multas.js |
| /advertir | moderator | DeepSeek/codigo_generado/075_Creating_Ban_Commands_for_Discord_Bot/m012_b001_sanciones.js |
| /apelar-sancion | public | codigo/Licencias_js_adaptado_CR/sanciones_v001.js |
| /aprobar-castigo | admin | Compatibilidad de la versión previa o implementación del requisito de configuración/persistencia. |
| /estadisticas-sanciones | staff | DeepSeek/codigo_generado/075_Creating_Ban_Commands_for_Discord_Bot/m012_b001_sanciones.js |
| /historial-sanciones | moderator | codigo/Licencias_js_adaptado_CR/sanciones_v001.js |
| /mis-sanciones | public | DeepSeek/codigo_generado/075_Creating_Ban_Commands_for_Discord_Bot/m012_b001_sanciones.js |
| /modlogs | moderator | DeepSeek/codigo_generado/075_Creating_Ban_Commands_for_Discord_Bot/m012_b001_sanciones.js |
| /sancionar | moderator | codigo/Licencias_js_adaptado_CR/sanciones_v001.js |
| /sanciones | moderator | DeepSeek/codigo_generado/044_Updated_Whitelist_Script_with_Complete_Code/m004_b016_sanciones.js |
| /vaciar-historial | admin | DeepSeek/codigo_generado/019_Analisis_de_sistema_de_componentes_V2/m004_b003_sanciones.js |
| /asignar-roles | admin | DeepSeek/codigo_generado/032_Analisis_de_migracion_a_Components_V2/m012_b001_asignar-roles.js |
| /ayuda | public | Compatibilidad de la versión previa o implementación del requisito de configuración/persistencia. |
| /container-test | admin | DeepSeek/codigo_generado/050_archivo/m018_b001_discord.js |
| /debug-v2 | admin | DeepSeek/codigo_generado/050_archivo/m016_b003_bloque.js |
| /demo-completo | admin | DeepSeek/codigo_generado/053_Guia_de_componentes_V2_de_Discord.js/m004_b016_bloque.js |
| /demo-v2 | admin | DeepSeek/codigo_generado/053_Guia_de_componentes_V2_de_Discord.js/m004_b002_bloque.js |
| /developer | admin | DeepSeek/codigo_generado/007_Crear_comando_developer_para_eliminar_canales/m002_b003_developer.js |
| /entorno | moderator | codigo/Licencias_js_adaptado_CR/entorno_v001.js |
| /erlc | moderator | DeepSeek/codigo_generado/034_Integracion_de_API_de_PRC_en_bot_Discord/m004_b005_erlc.js |
| /estado | public | Compatibilidad de la versión previa o implementación del requisito de configuración/persistencia. |
| /joiner | staff | DeepSeek/codigo_generado/003_Discord_bot_joiner_command_with_TTS/m002_b005_joiner.js |
| /panel | public | DeepSeek/codigo_generado/047_Discord_Bot_and_Dashboard_Development_Plan/m012_b008_panel.js |
| /prueba | admin | DeepSeek/codigo_generado/050_archivo/m008_b001_prueba.js |
| /reset-nicknames | admin | DeepSeek/codigo_generado/025_Discord_bot_whitelist_command_code/m006_b001_bloque.txt |
| /reset-nicks | admin | DeepSeek/codigo_generado/025_Discord_bot_whitelist_command_code/m010_b002_bloque.txt |
| /v2-components | admin | DeepSeek/conversaciones/053_Guia_de_componentes_V2_de_Discord.js/mensaje_003_original.txt |
| /version | admin | DeepSeek/codigo_generado/050_archivo/m014_b005_discord.js |
| /actualizar-info | admin | DeepSeek/codigo_generado/063_Analisis_y_mejoras_de_sistema_judicial_Discord/m010_b001_registrarplacas.js |
| /actualizar-jerarquia | admin | codigo/Comando_jerarquia_staff/actualizar-jerarquia_v001.js |
| /calificar-staff | public | codigo/Licencias_js_adaptado_CR/calificaciones_v001.js |
| /ver-calificaciones | staff | codigo/Licencias_js_adaptado_CR/calificaciones_v001.js |
| /ver-placas | staff | DeepSeek/codigo_generado/063_Analisis_y_mejoras_de_sistema_judicial_Discord/m010_b002_ver-placas.js |
| /ticket-sys | admin | DeepSeek/codigo_generado/024_este_es_tickets.js/m004_b001_tickets.js |
| /ticket | public | DeepSeek/codigo_generado/047_Discord_Bot_and_Dashboard_Development_Plan/m008_b016_bloque.js |
| /eliminar-vehiculo | police | codigo/Licencias_js_adaptado_CR/vehicular_v001.js |
| /registrar-vehiculo | public | codigo/Licencias_js_adaptado_CR/vehicular_v001.js |
| /vehiculos | public | codigo/Licencias_js_adaptado_CR/vehicular_v001.js |
| /aceptar-wl | staff | DeepSeek/codigo_generado/059_necesito_hacer_comandos_para_mi/m010_b007_whitelist.js |
| /rechazar-wl | staff | DeepSeek/codigo_generado/059_necesito_hacer_comandos_para_mi/m010_b007_whitelist.js |
| /revisar-2fase | staff | DeepSeek/codigo_generado/026_Error_en_codigo_de_bot_Discord/m002_b018_whitelist.js |
| /verificacion | public | codigo/Licencias_js_adaptado_CR/verificacion_v001.js |
| /verificarme | public | DeepSeek/codigo_generado/044_Updated_Whitelist_Script_with_Complete_Code/m002_b001_whitelist.js |

## Nombres que no representan comandos de Maes RP

- /registrar_cedula: Nomenclatura de variantes antiguas/de otros países; las funciones se mantienen en los comandos de cédulas con guiones.
- /ver_cedula: Nomenclatura de variantes antiguas/de otros países; las funciones se mantienen en los comandos de cédulas con guiones.
- /eliminar_cedula: Nomenclatura de variantes antiguas/de otros países; las funciones se mantienen en los comandos de cédulas con guiones.
- /registrar_id: Nomenclatura de variantes antiguas/de otros países; las funciones se mantienen en los comandos de cédulas con guiones.
- /ver_id: Nomenclatura de variantes antiguas/de otros países; las funciones se mantienen en los comandos de cédulas con guiones.
- /eliminar_id: Nomenclatura de variantes antiguas/de otros países; las funciones se mantienen en los comandos de cédulas con guiones.
- /ping: TicketPro: proyecto separado. La función equivalente del soporte Maes RP se conserva en tickets y sus botones.
- /cerrar: TicketPro: proyecto separado. La función equivalente del soporte Maes RP se conserva en tickets y sus botones.
- /reclamar: TicketPro: proyecto separado. La función equivalente del soporte Maes RP se conserva en tickets y sus botones.
- /renombrar: TicketPro: proyecto separado. La función equivalente del soporte Maes RP se conserva en tickets y sus botones.
- /nombre-comando: Fragmento didáctico/ejemplo; no se considera un comando productivo. El catálogo de artículos real se mantiene como datos de multas.
- /seleccionar-pais: Fragmento didáctico/ejemplo; no se considera un comando productivo. El catálogo de artículos real se mantiene como datos de multas.
- /mi-comando: Fragmento didáctico/ejemplo; no se considera un comando productivo. El catálogo de artículos real se mantiene como datos de multas.
- /articulos: Fragmento didáctico/ejemplo; no se considera un comando productivo. El catálogo de artículos real se mantiene como datos de multas.
