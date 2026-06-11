const form = document.getElementById('freeClassForm');
const classSelect = document.getElementById('classSelect');
const submitButton = document.getElementById('submitButton');
const formMessage = document.getElementById('formMessage');
const emptyState = document.getElementById('emptyState');
const formBody = document.getElementById('formBody');
const classField = document.getElementById('classField');
const availabilityNote = document.getElementById('availabilityNote');
const pageTitle = document.getElementById('pageTitle');
const pageCopy = document.getElementById('pageCopy');
const formTitle = document.getElementById('formTitle');
const formIntro = document.getElementById('formIntro');
const limitNote = document.getElementById('limitNote');
const detailOne = document.getElementById('detailOne');
const detailTwo = document.getElementById('detailTwo');
const detailThree = document.getElementById('detailThree');

const API_URL = '/api/clases-gratis';
let formMode = 'registration';

loadClasses();

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const payload = {
    intent: formMode === 'lead' ? 'lead' : 'registration',
    nombre: form.nombre.value.trim(),
    apellido: form.apellido.value.trim(),
    email: form.email.value.trim(),
    telefono: form.telefono.value.trim(),
    consentimiento: form.consentimiento.checked,
    source: 'form1'
  };

  if (formMode === 'registration') {
    payload.class_id = form.class_id.value;
  }

  setSubmitting(true);
  showMessage('info', formMode === 'lead'
    ? 'Estamos guardando tus datos.'
    : 'Estamos revisando el cupo y guardando tu registro.');

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (result.code === 'class_full') {
        await loadClasses();
      }
      throw new Error(result.message || 'No pudimos completar el registro.');
    }

    form.reset();
    showMessage('success', result.message || getSuccessFallback());
    await loadClasses({ keepMessage: true });
  } catch (error) {
    showMessage('error', `${error.message} Si necesitas ayuda, escribenos por WhatsApp.`);
  } finally {
    setSubmitting(false);
  }
});

async function loadClasses(options = {}) {
  setLoading(true);
  if (!options.keepMessage) {
    showMessage('info', 'Cargando clases disponibles.');
  }

  try {
    const response = await fetch(API_URL);
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.message || 'No pudimos cargar las clases.');
    }

    renderClasses(result.classes || []);
    if (!options.keepMessage) {
      clearMessage();
    }
  } catch (error) {
    renderLoadError();
    showMessage('error', `${error.message} Intenta nuevamente en unos minutos.`);
  } finally {
    setLoading(false);
  }
}

function renderClasses(classes) {
  classSelect.innerHTML = '<option value="">Selecciona una clase</option>';

  for (const classItem of classes) {
    const option = document.createElement('option');
    option.value = classItem.id;
    option.textContent = `${classItem.label} · ${classItem.remaining} cupo${classItem.remaining === 1 ? '' : 's'}`;
    classSelect.append(option);
  }

  const hasClasses = classes.length > 0;
  formMode = hasClasses ? 'registration' : 'lead';
  formBody.hidden = false;
  classField.hidden = !hasClasses;
  classSelect.required = hasClasses;
  classSelect.disabled = !hasClasses;
  if (!hasClasses) {
    classSelect.value = '';
  }
  emptyState.hidden = hasClasses;
  submitButton.disabled = false;
  submitButton.textContent = hasClasses ? 'Registrarme' : 'Avisarme primero';
  availabilityNote.textContent = hasClasses
    ? 'Mostramos solo clases con cupos disponibles.'
    : 'Las clases gratuitas de esta semana ya estan completas.';
  pageTitle.textContent = hasClasses
    ? 'Reserva tu cupo para practicar con nosotras.'
    : 'Lo siento, no quedan mas cupos para esta semana.';
  pageCopy.textContent = hasClasses
    ? 'Elige una clase disponible, deja tus datos y guardaremos tu cupo. Cada clase tiene cupos limitados para cuidar la experiencia.'
    : 'Lamentablemente no tenemos mas cupos para las clases gratuitas de esta semana. Dejanos tus datos y enterate primero de otras clases gratuitas en el futuro.';
  formTitle.textContent = hasClasses ? 'Elige tu clase' : 'Enterate primero';
  formIntro.textContent = hasClasses
    ? 'Completa tus datos para reservar uno de los cupos gratuitos disponibles.'
    : 'Dejanos tus datos y te avisaremos antes cuando abramos nuevas clases gratuitas.';
  limitNote.textContent = hasClasses
    ? 'Recuerda: solo puedes reservar una clase gratuita por semana.'
    : 'Si ya nos dejaste tus datos, no necesitas registrarte de nuevo.';
  detailOne.textContent = hasClasses
    ? 'Mostramos solo las clases que todavia tienen cupo disponible.'
    : 'Te escribiremos primero cuando abramos una nueva invitacion gratuita.';
  detailTwo.textContent = hasClasses
    ? 'Tu email o telefono solo puede registrarse una vez en esta invitacion gratuita.'
    : 'Tus datos quedaran en una lista de interes para futuras clases gratuitas.';
  detailThree.textContent = hasClasses
    ? 'Despues del registro, nuestro equipo puede contactarte por WhatsApp si necesitamos confirmar algun detalle.'
    : 'Podremos contactarte por WhatsApp o email cuando tengamos nuevos cupos.';
}

function renderLoadError() {
  formMode = 'error';
  formBody.hidden = true;
  classField.hidden = true;
  emptyState.hidden = true;
  submitButton.disabled = true;
  availabilityNote.textContent = 'No pudimos confirmar la disponibilidad en este momento.';
}

function setLoading(isLoading) {
  classSelect.disabled = isLoading || formMode === 'lead';
  if (isLoading) {
    classSelect.innerHTML = '<option value="">Cargando clases...</option>';
  }
}

function setSubmitting(isSubmitting) {
  submitButton.disabled = isSubmitting || formBody.hidden;
  submitButton.textContent = isSubmitting
    ? 'Guardando...'
    : (formMode === 'lead' ? 'Avisarme primero' : 'Registrarme');
}

function showMessage(type, text) {
  formMessage.className = `form-message ${type} is-visible`;
  formMessage.textContent = text;
}

function clearMessage() {
  formMessage.className = 'form-message';
  formMessage.textContent = '';
}

function getSuccessFallback() {
  return formMode === 'lead'
    ? 'Listo. Te avisaremos primero cuando abramos nuevas clases gratuitas.'
    : 'Tu cupo quedo registrado. Te contactaremos por WhatsApp.';
}
