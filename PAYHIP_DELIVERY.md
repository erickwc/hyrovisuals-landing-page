# Compra y entrega de HYRO Visuals

Payhip cobra en su checkout y redirige al comprador a `https://byhyro.com/biblioteca/?compra=procesando`. Antes del pago, HYRO crea un intento ligado a la cuenta iniciada y lo adjunta como `metadata[hyro_intent]`. El webhook `paid` verifica la firma de Payhip y registra la transacción una sola vez. La licencia se genera en HYRO y pertenece a la cuenta que inició la compra, aunque el correo usado para pagar sea distinto. Un reembolso completo revoca el acceso.

La biblioteca permite mostrar o copiar la clave y descargar el instalador de prueba Windows desde un bucket R2 privado. El botón permanece disponible en la cuenta, pero cada descarga vuelve a verificar la sesión y una compra activa. Payhip tiene desactivada la generación de claves nuevas. Los archivos históricos que ya están en Payhip aún no se han retirado: quitarlos afectaría también a compradores anteriores. Se revisarán después de una prueba completa del nuevo flujo.

La app de escritorio usa `license-server`, no la API de licencias de Payhip. La primera activación vincula la clave a un equipo; otra computadora es rechazada. El servidor firma un permiso de 7 días que la app verifica con una clave pública. Soporte puede liberar un equipo desde el panel administrador. La clave privada de firma y la clave de cifrado se guardan solo como secretos de Supabase.

## Verificación de compra pendiente

- Completar una compra de prueba desde una cuenta HYRO iniciada y comprobar la redirección a `/biblioteca/`.
- Confirmar que el webhook registra un solo pedido y que la clave se puede mostrar solo desde la cuenta compradora.
- Descargar el instalador de prueba desde esa cuenta y confirmar que otra sesión recibe acceso denegado.
- Activar la app compilada con esa clave, repetir en el mismo equipo y rechazar un segundo equipo.
- Comprobar un reembolso completo y la revocación de la licencia.
