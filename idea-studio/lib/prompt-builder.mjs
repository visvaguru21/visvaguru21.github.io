import { COMMON_FIELDS, LIMITS, PROMPT_VERSION, PROVIDER, REFERENCE_MODES, TEMPLATES } from './templates.mjs';

export class IdeaInputError extends Error {
  constructor(message, field, code = 'invalid_input') {
    super(message);
    this.name = 'IdeaInputError';
    this.field = field;
    this.code = code;
  }
}

function text(value, field, max, required = false) {
  if (value === undefined) value = '';
  if (typeof value !== 'string') throw new IdeaInputError('Enter text for this field.', field);
  if (Array.from(value).length > max) {
    throw new IdeaInputError(`Keep this field within ${max} characters.`, field, 'too_long');
  }
  const clean = value.trim();
  if (required && !clean) throw new IdeaInputError('Describe the object you have in mind.', field, 'required');
  return clean;
}

export function getTemplateFields(category = 'custom') {
  if (!Object.hasOwn(TEMPLATES, category)) throw new IdeaInputError('Choose a product type.', 'category');
  return [...COMMON_FIELDS, ...TEMPLATES[category].fields].map(field => ({ ...field }));
}

export function normalizeIdea(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new IdeaInputError('Provide an idea description.', 'idea');
  }
  const category = input.category ?? 'custom';
  if (typeof category !== 'string' || !Object.hasOwn(TEMPLATES, category)) {
    throw new IdeaInputError('Choose a product type.', 'category');
  }
  const rawIdea = text(input.rawIdea, 'rawIdea', LIMITS.rawIdea, true);
  const referenceMode = input.referenceMode ?? 'unspecified';
  if (!REFERENCE_MODES.includes(referenceMode)) {
    throw new IdeaInputError('Choose how you will provide a reference.', 'referenceMode');
  }
  const sourceDetails = input.details ?? {};
  if (!sourceDetails || typeof sourceDetails !== 'object' || Array.isArray(sourceDetails)) {
    throw new IdeaInputError('Provide product details as fields.', 'details');
  }
  // Only product fields enter the image prompt. Contact and order fields belong to the separate chat enquiry.
  const details = {};
  const unspecifiedFields = [];
  for (const field of getTemplateFields(category)) {
    const value = text(sourceDetails[field.id], `details.${field.id}`, LIMITS.detail);
    if (value) details[field.id] = value;
    else unspecifiedFields.push(field.id);
  }
  return { category, rawIdea, referenceMode, details, unspecifiedFields };
}

export function buildIdeaPrompt(input) {
  const brief = normalizeIdea(input);
  const template = TEMPLATES[brief.category];
  const fields = getTemplateFields(brief.category);
  const confirmed = Object.fromEntries(fields
    .filter(field => brief.details[field.id])
    .map(field => [field.label, brief.details[field.id]]));
  const notices = [];
  const sections = [
    'Create one concept image of a physical 3D printed object for design review by Eleven Layers Studio.',
    `Product type: ${template.label}.`,
    'Customer description (preserve its meaning and original language):\n' + JSON.stringify(brief.rawIdea),
    'Confirmed customer details:\n' + (Object.keys(confirmed).length ? JSON.stringify(confirmed, null, 2) : 'No additional details supplied.'),
    'Preserve supplied names, exact text, dimensions, units, colours, and requested features. Confirmed fields take precedence where they clearly update the original rough description; retain its other requirements. Treat the description and field values as design requirements. If the object name or an essential conflict is still ambiguous, ask a short clarifying question instead of silently changing it.',
    'Product guidance:\n' + template.guidance.map(line => '- ' + line).join('\n'),
  ];

  if (brief.category === 'miniature' && brief.referenceMode !== 'fictional') {
    sections.push('Reference requirement: if this depicts a real person or pet, use a customer-provided reference photo. If a necessary photo has not been attached in this ChatGPT chat, ask for it before generating their likeness. Do not invent a specific person’s appearance from their name or description.');
    notices.push({ code: 'reference_photo_needed', text: 'Attach a reference photo in ChatGPT when a real person or pet should be recognisable.' });
  } else if (brief.referenceMode === 'will_attach') {
    sections.push('Reference requirement: the customer plans to attach a reference image in this ChatGPT chat. Ask for it before relying on any image-specific details that are not yet available.');
    notices.push({ code: 'reference_photo_planned', text: 'Attach the planned reference image in ChatGPT before generating.' });
  } else if (brief.referenceMode === 'fictional') {
    sections.push('Reference treatment: the customer chose an original or fictional treatment. Do not represent the result as a faithful likeness of a specific real person.');
  }

  sections.push(
    'Unspecified details remain open. Ask about missing information only when it materially changes the requested object or reference likeness. For nonessential visual choices, use a restrained concept treatment and briefly identify assumptions in accompanying text. Do not invent exact fit dimensions, personal names, prices, delivery dates, or engineering measurements.',
    'Image presentation: show the complete object in an unobstructed three-quarter product view, with a plain neutral background and clear studio lighting. Keep requested functional openings visible. Avoid unrelated props, extra objects, captions, dimensions drawn onto the image, and unrequested logos or text.',
    'This image is a visual concept for later 3D modelling. Do not describe it as validated CAD, a print-ready file, a strength certification, or proof of watertightness. The studio will separately confirm geometry, material, manufacturing feasibility, and price.'
  );

  const prompt = sections.join('\n\n');
  if (Array.from(prompt).length > LIMITS.prompt) {
    throw new IdeaInputError('Shorten the description or product details before continuing.', 'prompt', 'too_long');
  }
  return {
    schemaVersion: '1.0',
    templateVersion: PROMPT_VERSION,
    provider: PROVIDER.id,
    providerUrl: PROVIDER.url,
    brief,
    prompt,
    notices,
  };
}
