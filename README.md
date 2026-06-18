# Refugio Serenia Form1

Mini-proyecto independiente para el formulario de clases gratuitas.

## Google Sheet

El Sheet puede vivir en cualquier cuenta de Google. La cuenta duena debe compartir el archivo con el email de la service account configurada en Cloudflare:

```text
GOOGLE_SERVICE_ACCOUNT_EMAIL
```

Permiso requerido: Editor.

Crear estas pestanas con headers en la fila 1:

```text
FreeClasses
class_id, class_name, starts_at, teacher, capacity, active, notes
```

```text
FreeClassRegistrations
registration_id, created_at, status, class_id, class_name, nombre, apellido, email, telefono, consentimiento, source
```

```text
FreeClassWaitlist
contact_id, created_at, status, nombre, apellido, email, telefono, consentimiento, source
```

`active` acepta valores como `yes`, `true`, `1`, `si`, `active` o `activo`.
Si `capacity` esta vacio o no es valido, el sistema usa 6 cupos.

## Cloudflare Pages

Desplegar esta carpeta como proyecto Pages independiente:

```text
forms/
```

Variables/secretos requeridos:

```text
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY
GOOGLE_SHEET_ID
```

Variables/secretos para correo de confirmacion:

```text
RESEND_API_KEY
RESEND_FROM_EMAIL
PUBLIC_FORM_URL
```

`RESEND_API_KEY` habilita el envio con Resend. Si no esta configurada, el registro se guarda igual y no se intenta enviar correo.
`RESEND_FROM_EMAIL` es opcional y por defecto usa `Refugio Serenia <no-reply@refugioserenia.com>`.
`PUBLIC_FORM_URL` es opcional y por defecto usa `https://form.refugioserenia.com/`.

Dominio sugerido:

```text
form1.refugioserenia.com
```

## Endpoints

```text
GET /api/clases-gratis
POST /api/clases-gratis
```

La reserva oficial se escribe directamente en `FreeClassRegistrations`.
Cuando Resend esta configurado, cada reserva exitosa envia un correo de confirmacion con fecha, hora, enlace de Google Calendar, WhatsApp y enlace para reservar otra clase.
Si todas las clases estan llenas, la pagina cambia a formulario de aviso futuro y guarda los datos en `FreeClassWaitlist`.
