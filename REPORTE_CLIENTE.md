# Reporte de entrega - Formulario de clases de cortesia

## Resumen

Se implemento y publico un formulario independiente para gestionar registros a las clases gratuitas de cortesia por apertura de Refugio Serenia.

El formulario vive fuera del sitio web principal y funciona como un enlace puntual para campanas, redes sociales o piezas promocionales. Su objetivo es captar registros, controlar cupos disponibles y guardar la informacion directamente en Google Sheets para facilitar la operacion del equipo.

## Que se entrego

- Pagina publica del formulario en Cloudflare Pages.
- Subdominio de produccion para compartir en campanas.
- Formulario de registro con nombre, apellido, email, telefono, clase a reservar y consentimiento de uso de datos.
- Control automatico de cupos por clase.
- Bloqueo de registros duplicados por email o telefono.
- Mensaje alternativo cuando ya no quedan cupos disponibles.
- Formulario de interes futuro cuando las clases estan llenas.
- Integracion directa con Google Sheets para que el equipo pueda operar sin herramientas tecnicas.

## Importancia para el proyecto

Esta solucion permite lanzar campanas de captacion de manera rapida, ordenada y medible. En lugar de recibir mensajes dispersos por WhatsApp o Instagram, cada registro queda centralizado en una hoja de calculo con estructura clara.

Tambien reduce el riesgo operativo de sobrecargar una clase, ya que el sistema solo muestra clases activas con cupos disponibles y valida nuevamente al momento de enviar el formulario.

## Infraestructura

La solucion esta compuesta por:

- **Cloudflare Pages:** hospeda la pagina publica y las funciones del servidor.
- **Pages Functions:** valida disponibilidad, duplicados y escritura de registros.
- **Google Sheets API:** permite leer clases y guardar registros automaticamente.
- **Google Service Account:** cuenta tecnica que autoriza al servidor a escribir en el Sheet.
- **GitHub:** repositorio del proyecto para control de versiones y despliegues.

Repositorio:

```text
https://github.com/jimenezjma/sereniaforms
```

## Google Sheets

El Sheet operativo tiene tres pestanas:

```text
FreeClasses
```

Contiene la lista de clases, cupos, fecha/hora y estado activo.

```text
FreeClassRegistrations
```

Guarda las personas que reservaron una clase.

```text
FreeClassWaitlist
```

Guarda personas interesadas cuando ya no quedan cupos disponibles.

## Reglas de negocio

- Cada clase tiene un cupo configurable.
- Por defecto, se trabaja con 6 cupos por clase.
- Una persona solo puede registrarse una vez por campana.
- El duplicado se valida por email o telefono.
- Solo se muestran clases con `active = yes`.
- Si una clase ya paso, el Sheet puede cambiar `active` automaticamente usando formula.
- Si todas las clases estan llenas, el formulario cambia a captacion de interes futuro.

Formula sugerida para la columna `active` en Google Sheets en espanol:

```text
=SI(C2="";"";SI(C2>AHORA();"yes";"no"))
```

## Operacion diaria

Para abrir nuevas clases, el equipo solo debe agregar filas en `FreeClasses` con:

```text
class_id, class_name, starts_at, teacher, capacity, active, notes
```

Para cerrar una clase manualmente, cambiar `active` a:

```text
no
```

Para revisar inscritos, usar la pestana:

```text
FreeClassRegistrations
```

Para futuras comunicaciones o nuevas invitaciones, usar:

```text
FreeClassWaitlist
```

## Consideraciones

Google Sheets no es una base de datos transaccional. Para el volumen esperado de esta campana, el riesgo de que dos personas tomen el ultimo cupo exactamente al mismo tiempo es bajo y fue aceptado.

Si en el futuro el volumen aumenta, se recomienda migrar el control de cupos a una base de datos transaccional como Cloudflare D1 o Durable Objects.

## Estado final

El formulario esta en produccion, conectado al Sheet operativo y listo para ser usado en campanas de Instagram, WhatsApp o cualquier canal promocional de Refugio Serenia.
