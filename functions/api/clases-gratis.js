import { json, methodNotAllowed, optionsResponse } from '../_lib/http.js';
import { sendRegistrationConfirmationEmail } from '../_lib/email.js';
import { createFreeClassLead, createFreeClassRegistration, getAvailableFreeClasses, normalizeDigits, normalizeEmail } from '../_lib/sheets.js';

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet({ env }) {
  try {
    const classes = await getAvailableFreeClasses(env);
    return json({
      ok: true,
      classes,
      sold_out: classes.length === 0
    });
  } catch (error) {
    return json({
      ok: false,
      message: 'No pudimos cargar las clases disponibles en este momento.',
      detail: error.message
    }, { status: 502 });
  }
}

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ message: 'El cuerpo de la solicitud no es JSON valido.' }, { status: 400 });
  }

  const intent = payload.intent === 'lead' ? 'lead' : 'registration';
  const validation = validatePayload(payload, intent);
  if (!validation.ok) {
    return json({ message: validation.message, code: validation.code }, { status: 400 });
  }

  try {
    if (intent === 'lead') {
      const result = await createFreeClassLead(env, payload);

      return json({
        ok: true,
        status: result.existing ? 'lead_existing' : 'lead_created',
        contact_id: result.lead.contact_id,
        message: result.existing
          ? 'Ya tenemos tus datos para avisarte primero sobre futuras clases gratuitas.'
          : 'Listo. Te avisaremos primero cuando abramos nuevas clases gratuitas.'
      });
    }

    const result = await createFreeClassRegistration(env, payload);
    if (!result.ok) {
      return json({
        ok: false,
        code: result.code,
        message: result.message
      }, { status: result.status || 409 });
    }

    const emailResult = await trySendConfirmationEmail(env, result);

    return json({
      ok: true,
      status: 'registered',
      registration_id: result.registration.registration_id,
      remaining: result.remaining,
      confirmation_email_sent: emailResult.sent,
      message: emailResult.sent
        ? 'Tu cupo quedo registrado. Te enviamos la confirmacion a tu correo.'
        : 'Tu cupo quedo registrado correctamente. Te contactaremos por WhatsApp si necesitamos confirmar algo.'
    });
  } catch (error) {
    return json({
      ok: false,
      message: 'No pudimos guardar tu registro en este momento.',
      detail: error.message
    }, { status: 502 });
  }
}

async function trySendConfirmationEmail(env, result) {
  try {
    return await sendRegistrationConfirmationEmail(env, {
      registration: result.registration,
      classItem: result.classItem
    });
  } catch (error) {
    console.error('Confirmation email failed', {
      registration_id: result.registration?.registration_id,
      message: error.message
    });
    return { sent: false, error };
  }
}

export async function onRequestPut() {
  return methodNotAllowed();
}

export async function onRequestDelete() {
  return methodNotAllowed();
}

function validatePayload(payload, intent) {
  const requiredFields = intent === 'lead'
    ? ['nombre', 'apellido', 'email', 'telefono']
    : ['nombre', 'apellido', 'email', 'telefono', 'class_id'];

  for (const field of requiredFields) {
    if (!String(payload[field] || '').trim()) {
      return { ok: false, code: 'missing_field', message: `Falta el campo ${field}.` };
    }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(payload.email))) {
    return { ok: false, code: 'invalid_email', message: 'El email no parece valido.' };
  }

  if (normalizeDigits(payload.telefono).length < 7) {
    return { ok: false, code: 'invalid_phone', message: 'El numero telefonico no parece valido.' };
  }

  if (payload.consentimiento !== true) {
    return { ok: false, code: 'consent_required', message: 'Debes aceptar el uso de datos para continuar.' };
  }

  return { ok: true };
}
