const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Refugio Serenia <no-reply@refugioserenia.com>';
const DEFAULT_CONTACT_WHATSAPP = 'https://wa.me/573154444799';
const DEFAULT_FORM_URL = 'https://form.refugioserenia.com/';
const DEFAULT_ICON_URL = 'https://refugioserenia.com/assets/icons/refugio-serenia-icon.png';
const DEFAULT_LOCATION = 'Cl. 134a #13-40, Bogota, Colombia';
const DEFAULT_TIME_ZONE = 'America/Bogota';
const DEFAULT_DURATION_MINUTES = 60;

export async function sendRegistrationConfirmationEmail(env, { registration, classItem }) {
  if (!env.RESEND_API_KEY) {
    return { sent: false, skipped: true, reason: 'missing_resend_api_key' };
  }

  const payload = buildRegistrationConfirmationPayload(env, { registration, classItem });
  const response = await fetch(RESEND_EMAILS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `free-class-confirmation-${registration.registration_id}`.slice(0, 256)
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Resend failed for ${registration.email}`);
  }

  return { sent: true, data };
}

function buildRegistrationConfirmationPayload(env, { registration, classItem }) {
  const details = resolveClassDetails({ registration, classItem });
  const firstName = titleCase(registration.nombre || '');
  const className = clean(registration.class_name || classItem?.class_name || details.className);
  const formUrl = clean(env.PUBLIC_FORM_URL) || DEFAULT_FORM_URL;
  const location = clean(env.FREE_CLASS_LOCATION) || DEFAULT_LOCATION;
  const iconUrl = clean(env.EMAIL_ICON_URL) || DEFAULT_ICON_URL;
  const contactWhatsapp = clean(env.CONTACT_WHATSAPP_URL) || DEFAULT_CONTACT_WHATSAPP;
  const calendarUrl = buildGoogleCalendarUrl({
    className,
    startsAt: details.startsAt,
    durationMinutes: DEFAULT_DURATION_MINUTES,
    location,
    description: `Clase de cortesia en Refugio Serenia. Si tienes dudas, escribenos por WhatsApp.`
  });
  const whatsappUrl = `${contactWhatsapp}?text=${encodeURIComponent(`Hola, tengo una duda sobre mi clase de cortesia ${className} del ${formatDateSpanish(details.startsAt)} a las ${formatTimeSpanish(details.startsAt)}.`)}`;

  const common = {
    firstName,
    className,
    dateLabel: formatDateSpanish(details.startsAt),
    timeLabel: formatTimeSpanish(details.startsAt),
    teacher: clean(classItem?.teacher || ''),
    location,
    iconUrl,
    calendarUrl,
    whatsappUrl,
    formUrl
  };

  const payload = {
    from: clean(env.RESEND_FROM_EMAIL) || DEFAULT_FROM,
    to: [registration.email],
    subject: 'Tu cupo esta confirmado en Refugio Serenia',
    html: buildEmailHtml(common),
    text: buildEmailText(common),
    tags: [
      { name: 'type', value: 'free_class_confirmation' },
      { name: 'class_id', value: safeTagValue(registration.class_id) },
      { name: 'registration_id', value: safeTagValue(registration.registration_id) }
    ]
  };

  if (env.RESEND_REPLY_TO) {
    payload.reply_to = clean(env.RESEND_REPLY_TO);
  }

  return payload;
}

function resolveClassDetails({ registration, classItem }) {
  const className = clean(registration.class_name || classItem?.class_name || 'Clase gratuita');
  const startsAt = parseStartsAt(classItem?.starts_at) || parseStartsAt(registration.starts_at) || parseClassId(registration.class_id)?.startsAt;

  return {
    className,
    startsAt: startsAt || new Date().toISOString()
  };
}

function parseStartsAt(value) {
  const raw = clean(value);
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';

  const normalizedLocal = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (normalizedLocal) {
    const [, date, hour, minute, second = '00'] = normalizedLocal;
    return `${date}T${hour}:${minute}:${second}-05:00`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString();
}

function parseClassId(classId) {
  const match = clean(classId).match(/^(.*)-(\d{4}-\d{2}-\d{2})-(\d{4})$/);
  if (!match) return null;

  const [, slug, date, rawTime] = match;
  return {
    className: humanizeSlug(slug),
    startsAt: `${date}T${rawTime.slice(0, 2)}:${rawTime.slice(2)}:00-05:00`
  };
}

function buildEmailHtml({
  firstName,
  className,
  dateLabel,
  timeLabel,
  teacher,
  location,
  iconUrl,
  calendarUrl,
  whatsappUrl,
  formUrl
}) {
  const teacherRow = teacher
    ? `
                <tr>
                  <td style="padding:14px 14px;border-bottom:1px solid #e5d8c6;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a6f56">Guia</td>
                  <td style="padding:14px 14px;border-bottom:1px solid #e5d8c6;font-size:15px;color:#322c22">${escapeHtml(teacher)}</td>
                </tr>`
    : '';

  return `
    <div style="margin:0;padding:0;background:#f4eee6">
      <div style="display:none;max-height:0;overflow:hidden">Tu cupo quedo reservado. Agrega tu clase al calendario para que no se te pase.</div>
      <div style="max-width:680px;margin:0 auto;padding:32px 18px;font-family:Arial,Helvetica,sans-serif;color:#322c22;line-height:1.55">
        <div style="background:#fffaf3;border:1px solid #e5d8c6;border-radius:18px;overflow:hidden">
          <div style="background:#322c22;padding:30px 24px;text-align:center">
            <img src="${escapeHtml(iconUrl)}" width="52" alt="" style="display:block;margin:0 auto 12px;max-width:52px;width:52px;height:auto;border:0">
            <p style="margin:0 0 6px;font-family:Georgia,'Times New Roman',serif;font-size:18px;letter-spacing:.22em;color:#8f806d">REFUGIO</p>
            <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:38px;letter-spacing:.08em;color:#8f806d">SERENIA</p>
          </div>
          <div style="padding:34px 28px 30px">
            <p style="margin:0 0 12px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#8a6f56">Confirmacion de clase</p>
            <h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:400;line-height:1.15;color:#2f281f">Tu cupo esta confirmado</h1>
            <p style="margin:0 0 18px;font-size:16px">Hola ${escapeHtml(firstName || 'alli')},</p>
            <p style="margin:0 0 24px;font-size:16px">Tu cupo para <strong>${escapeHtml(className)}</strong> quedo reservado. Sera un gusto recibirte en el refugio.</p>
            <div style="background:#f7f1e9;border:1px solid #eadfce;border-radius:14px;padding:4px;margin:0 0 24px">
              <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
                <tr>
                  <td style="padding:14px 14px;border-bottom:1px solid #e5d8c6;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a6f56;width:112px">Clase</td>
                  <td style="padding:14px 14px;border-bottom:1px solid #e5d8c6;font-size:15px;color:#322c22">${escapeHtml(className)}</td>
                </tr>
                <tr>
                  <td style="padding:14px 14px;border-bottom:1px solid #e5d8c6;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a6f56;width:112px">Fecha</td>
                  <td style="padding:14px 14px;border-bottom:1px solid #e5d8c6;font-size:15px;color:#322c22">${escapeHtml(dateLabel)}</td>
                </tr>
                <tr>
                  <td style="padding:14px 14px;border-bottom:1px solid #e5d8c6;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a6f56">Hora</td>
                  <td style="padding:14px 14px;border-bottom:1px solid #e5d8c6;font-size:15px;color:#322c22">${escapeHtml(timeLabel)}</td>
                </tr>${teacherRow}
                <tr>
                  <td style="padding:14px 14px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a6f56">Lugar</td>
                  <td style="padding:14px 14px;font-size:15px;color:#322c22">${escapeHtml(location)}</td>
                </tr>
              </table>
            </div>
            <p style="margin:0 0 20px;color:#5e5042">Para que no se te pase, puedes agregar la clase a tu calendario o dejar un recordatorio en tu celular.</p>
            <p style="margin:0 0 26px">
              <a href="${escapeHtml(calendarUrl)}" style="display:inline-block;background:#6f604f;color:#fff;text-decoration:none;padding:13px 20px;border-radius:999px;font-weight:bold">Agregar a Google Calendar</a>
            </p>
            <div style="height:1px;background:#eadfce;margin:0 0 22px"></div>
            <p style="margin:0 0 16px;color:#5e5042">Si quieres vivir otra practica, puedes reservar otra clase diferente mientras haya cupos disponibles.</p>
            <p style="margin:0 0 24px">
              <a href="${escapeHtml(formUrl)}" style="display:inline-block;border:1px solid #6f604f;color:#6f604f;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:bold">Reservar otra clase</a>
            </p>
            <p style="margin:0;color:#5e5042">Si tienes alguna duda, escribenos <a href="${escapeHtml(whatsappUrl)}" style="color:#6f604f;font-weight:bold;text-decoration:none">por WhatsApp</a>.</p>
            <p style="margin:26px 0 0;color:#6f5d4b">Con carino,<br>Refugio Serenia</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildEmailText({
  firstName,
  className,
  dateLabel,
  timeLabel,
  teacher,
  location,
  calendarUrl,
  whatsappUrl,
  formUrl
}) {
  const lines = [
    `Hola ${firstName || 'alli'},`,
    '',
    `Tu cupo para ${className} quedo reservado.`,
    `Clase: ${className}`,
    `Fecha: ${dateLabel}`,
    `Hora: ${timeLabel}`,
  ];

  if (teacher) {
    lines.push(`Guia: ${teacher}`);
  }

  lines.push(
    `Lugar: ${location}`,
    '',
    'Para que no se te pase, agrega la clase a tu calendario o deja un recordatorio en tu celular.',
    `Google Calendar: ${calendarUrl}`,
    '',
    'Si quieres vivir otra practica, puedes reservar otra clase diferente mientras haya cupos disponibles.',
    `Reservar otra clase: ${formUrl}`,
    '',
    'Si tienes alguna duda, escribenos por WhatsApp.',
    whatsappUrl,
    '',
    'Con carino,',
    'Refugio Serenia'
  );

  return lines.join('\n');
}

function buildGoogleCalendarUrl({ className, startsAt, durationMinutes, location, description }) {
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const dates = `${formatCalendarUtc(start)}/${formatCalendarUtc(end)}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Refugio Serenia - ${className}`,
    dates,
    details: description,
    location,
    ctz: DEFAULT_TIME_ZONE
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function formatCalendarUtc(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function formatDateSpanish(startsAt) {
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: DEFAULT_TIME_ZONE
  }).format(new Date(startsAt));
}

function formatTimeSpanish(startsAt) {
  return new Intl.DateTimeFormat('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: DEFAULT_TIME_ZONE
  }).format(new Date(startsAt)).replace(/\s/g, ' ');
}

function humanizeSlug(slug) {
  return clean(slug).split('-').map(titleCase).join(' ');
}

function titleCase(value) {
  return clean(value).toLowerCase().replace(/\b\p{L}/gu, (char) => char.toUpperCase());
}

function clean(value) {
  return String(value || '').trim();
}

function safeTagValue(value) {
  return clean(value).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 256);
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}
