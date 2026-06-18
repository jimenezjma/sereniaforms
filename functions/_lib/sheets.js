import { base64UrlFromString, randomToken, signRs256 } from './crypto.js';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const FREE_CLASSES_SHEET = 'FreeClasses';
const FREE_REGISTRATIONS_SHEET = 'FreeClassRegistrations';
const FREE_WAITLIST_SHEET = 'FreeClassWaitlist';
const DEFAULT_CAPACITY = 6;

export const FREE_CLASS_HEADERS = [
  'class_id',
  'class_name',
  'starts_at',
  'teacher',
  'capacity',
  'active',
  'notes'
];

export const FREE_REGISTRATION_HEADERS = [
  'registration_id',
  'created_at',
  'status',
  'class_id',
  'class_name',
  'nombre',
  'apellido',
  'email',
  'telefono',
  'consentimiento',
  'source'
];

export const FREE_WAITLIST_HEADERS = [
  'contact_id',
  'created_at',
  'status',
  'nombre',
  'apellido',
  'email',
  'telefono',
  'consentimiento',
  'source'
];

let tokenCache = null;

export async function getAvailableFreeClasses(env) {
  const [classes, registrations] = await Promise.all([
    getFreeClasses(env),
    getFreeClassRegistrations(env)
  ]);
  const counts = countRegistrationsByClass(registrations);

  return classes
    .filter((classItem) => isActive(classItem.active))
    .map((classItem) => {
      const capacity = parseCapacity(classItem.capacity);
      const taken = counts.get(classItem.class_id) || 0;
      return {
        id: classItem.class_id,
        name: classItem.class_name,
        starts_at: classItem.starts_at,
        teacher: classItem.teacher,
        capacity,
        taken,
        remaining: Math.max(capacity - taken, 0),
        label: formatClassLabel(classItem)
      };
    })
    .filter((classItem) => classItem.id && classItem.name && classItem.remaining > 0)
    .sort(compareClasses);
}

export async function createFreeClassRegistration(env, payload) {
  const [classes, registrations] = await Promise.all([
    getFreeClasses(env),
    getFreeClassRegistrations(env)
  ]);
  const classItem = classes.find((item) => item.class_id === clean(payload.class_id));

  if (!classItem || !isActive(classItem.active)) {
    return {
      ok: false,
      status: 404,
      code: 'class_unavailable',
      message: 'La clase seleccionada ya no esta disponible.'
    };
  }

  const email = normalizeEmail(payload.email);
  const telefono = normalizeDigits(payload.telefono);
  const duplicateForClass = registrations.find((registration) => {
    if (!isCountableRegistration(registration)) return false;
    const sameClass = registration.class_id === classItem.class_id;
    const sameEmail = email && normalizeEmail(registration.email) === email;
    const samePhone = telefono && normalizeDigits(registration.telefono) === telefono;
    return sameClass && (sameEmail || samePhone);
  });

  if (duplicateForClass) {
    return {
      ok: false,
      status: 409,
      code: 'duplicate_class',
      message: 'Ya tienes un registro activo para esta clase. Puedes elegir otra clase disponible.'
    };
  }

  const capacity = parseCapacity(classItem.capacity);
  const taken = registrations.filter((registration) => (
    registration.class_id === classItem.class_id && isCountableRegistration(registration)
  )).length;

  if (taken >= capacity) {
    return {
      ok: false,
      status: 409,
      code: 'class_full',
      message: 'Esta clase ya no tiene cupos disponibles.'
    };
  }

  const now = new Date().toISOString();
  const registration = {
    registration_id: `FORM1-${Date.now()}-${randomToken(4)}`,
    created_at: now,
    status: 'registered',
    class_id: classItem.class_id,
    class_name: classItem.class_name,
    nombre: clean(payload.nombre),
    apellido: clean(payload.apellido),
    email,
    telefono: clean(payload.telefono),
    consentimiento: 'yes',
    source: clean(payload.source) || 'form1'
  };

  await appendSheetRow(
    env,
    `${FREE_REGISTRATIONS_SHEET}!A:K`,
    FREE_REGISTRATION_HEADERS.map((header) => registration[header] ?? '')
  );

  return {
    ok: true,
    registration,
    classItem: {
      class_id: classItem.class_id,
      class_name: classItem.class_name,
      starts_at: classItem.starts_at,
      teacher: classItem.teacher
    },
    remaining: Math.max(capacity - taken - 1, 0)
  };
}

export async function createFreeClassLead(env, payload) {
  const leads = await getFreeClassLeads(env);
  const email = normalizeEmail(payload.email);
  const telefono = normalizeDigits(payload.telefono);
  const duplicate = leads.find((lead) => {
    const sameEmail = email && normalizeEmail(lead.email) === email;
    const samePhone = telefono && normalizeDigits(lead.telefono) === telefono;
    return sameEmail || samePhone;
  });

  if (duplicate) {
    return {
      ok: true,
      existing: true,
      lead: duplicate
    };
  }

  const lead = {
    contact_id: `LEAD-${Date.now()}-${randomToken(4)}`,
    created_at: new Date().toISOString(),
    status: 'future_interest',
    nombre: clean(payload.nombre),
    apellido: clean(payload.apellido),
    email,
    telefono: clean(payload.telefono),
    consentimiento: 'yes',
    source: clean(payload.source) || 'form1'
  };

  await appendSheetRow(
    env,
    `${FREE_WAITLIST_SHEET}!A:I`,
    FREE_WAITLIST_HEADERS.map((header) => lead[header] ?? '')
  );

  return {
    ok: true,
    existing: false,
    lead
  };
}

export async function getFreeClasses(env) {
  const values = await readSheetRange(env, `${FREE_CLASSES_SHEET}!A:G`);
  return rowsToObjects(values, FREE_CLASS_HEADERS);
}

export async function getFreeClassRegistrations(env) {
  const values = await readSheetRange(env, `${FREE_REGISTRATIONS_SHEET}!A:K`);
  return rowsToObjects(values, FREE_REGISTRATION_HEADERS);
}

export async function getFreeClassLeads(env) {
  const values = await readSheetRange(env, `${FREE_WAITLIST_SHEET}!A:I`);
  return rowsToObjects(values, FREE_WAITLIST_HEADERS);
}

export async function readSheetRange(env, range) {
  const result = await sheetsFetch(env, `/v4/spreadsheets/${env.GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}`);
  return result.values || [];
}

export async function appendSheetRow(env, range, values) {
  const path = `/v4/spreadsheets/${env.GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  return sheetsFetch(env, path, {
    method: 'POST',
    body: JSON.stringify({ values: [values] })
  });
}

async function sheetsFetch(env, path, init = {}) {
  validateSheetsEnv(env);

  const token = await getGoogleAccessToken(env);
  const response = await fetch(`https://sheets.googleapis.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error?.message || 'Google Sheets request failed');
  }
  return data;
}

async function getGoogleAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.expiresAt > now + 60) {
    return tokenCache.accessToken;
  }

  const header = base64UrlFromString(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64UrlFromString(JSON.stringify({
    iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: GOOGLE_SHEETS_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    exp: now + 3600,
    iat: now
  }));
  const unsignedToken = `${header}.${claims}`;
  const signature = await signRs256(unsignedToken, env.GOOGLE_PRIVATE_KEY);
  const assertion = `${unsignedToken}.${signature}`;

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Google token request failed');
  }

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + Number(data.expires_in || 3600)
  };
  return tokenCache.accessToken;
}

function validateSheetsEnv(env) {
  const required = [
    'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    'GOOGLE_PRIVATE_KEY',
    'GOOGLE_SHEET_ID'
  ];
  const missing = required.filter((key) => !env[key]);

  if (missing.length) {
    throw new Error(`Missing Google Sheets env vars: ${missing.join(', ')}`);
  }
}

function rowsToObjects(values, fallbackHeaders) {
  if (!values.length) return [];
  const headerRow = values[0].map((value) => clean(value));
  const hasHeaders = fallbackHeaders.every((header) => headerRow.includes(header));
  const headers = hasHeaders ? headerRow : fallbackHeaders;
  const rows = hasHeaders ? values.slice(1) : values;

  return rows
    .filter((row) => row.some((cell) => clean(cell)))
    .map((row) => headers.reduce((record, header, index) => {
      record[header] = clean(row[index]);
      return record;
    }, {}));
}

function countRegistrationsByClass(registrations) {
  const counts = new Map();

  for (const registration of registrations) {
    if (!registration.class_id || !isCountableRegistration(registration)) continue;
    counts.set(registration.class_id, (counts.get(registration.class_id) || 0) + 1);
  }
  return counts;
}

function isCountableRegistration(registration) {
  return clean(registration.status).toLowerCase() !== 'cancelled';
}

function isActive(value) {
  const normalized = clean(value).toLowerCase();
  return ['yes', 'true', '1', 'si', 'sí', 'active', 'activo'].includes(normalized);
}

function parseCapacity(value) {
  const capacity = Number.parseInt(clean(value), 10);
  return Number.isFinite(capacity) && capacity > 0 ? capacity : DEFAULT_CAPACITY;
}

function compareClasses(a, b) {
  const dateA = Date.parse(a.starts_at);
  const dateB = Date.parse(b.starts_at);

  if (Number.isFinite(dateA) && Number.isFinite(dateB)) return dateA - dateB;
  if (Number.isFinite(dateA)) return -1;
  if (Number.isFinite(dateB)) return 1;
  return a.name.localeCompare(b.name, 'es');
}

function formatClassLabel(classItem) {
  const parts = [
    classItem.class_name,
    classItem.starts_at,
    classItem.teacher ? `con ${classItem.teacher}` : ''
  ].filter(Boolean);
  return parts.join(' · ');
}

function clean(value) {
  return String(value || '').trim().slice(0, 500);
}

export function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

export function normalizeDigits(value) {
  return String(value || '').replace(/\D/g, '');
}
