/*
 * Configuración común de las suites e2e y de integración (B5): las pruebas
 * nunca envían correos reales. Las variables del proceso tienen prioridad
 * sobre back/.env, así que esto anula la configuración SMTP de Brevo.
 * Las pruebas del adaptador SMTP construyen su propio ProveedorCorreoExterno
 * contra un servidor local.
 */
process.env['CORREO_MODO'] = 'desactivado';
