import { getTemplateFields, IdeaInputError, normalizeIdea } from './prompt-builder.mjs';
import { TEMPLATES } from './templates.mjs';

export const CHAT_CHANNELS = Object.freeze({
  whatsapp: Object.freeze({ label: 'WhatsApp', url: 'https://wa.me/916369211299' }),
  instagram: Object.freeze({ label: 'Instagram', url: 'https://www.instagram.com/eleven.layers.3d/' }),
});

// A conservative application fallback threshold, not a promised platform limit.
export const MAX_CHAT_LINK_LENGTH = 2000;

function optionalText(value, field, max) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || Array.from(value).length > max) {
    throw new IdeaInputError(`Enter text within ${max} characters.`, field);
  }
  return value.trim();
}

function readOrder(order) {
  if (!order || typeof order !== 'object' || Array.isArray(order)) {
    throw new IdeaInputError('Provide the optional enquiry details as fields.', 'order');
  }
  let quantity = '';
  if (order.quantity !== undefined && order.quantity !== null && order.quantity !== '') {
    const raw = String(order.quantity).trim();
    const number = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(number) || number < 1) {
      throw new IdeaInputError('Enter a positive whole-number quantity, or leave it blank.', 'quantity');
    }
    quantity = String(number);
  }
  const neededBy = optionalText(order.neededBy, 'neededBy', 10);
  if (neededBy && (!/^\d{4}-\d{2}-\d{2}$/.test(neededBy) ||
      Number.isNaN(Date.parse(neededBy+'T12:00:00Z')) ||
      new Date(neededBy+'T12:00:00Z').toISOString().slice(0,10) !== neededBy)) {
    throw new IdeaInputError('Choose a valid date, or leave it blank.', 'neededBy');
  }
  if (order.hasImage !== undefined && typeof order.hasImage !== 'boolean') {
    throw new IdeaInputError('Choose whether you have an image to attach.', 'hasImage');
  }
  return {
    quantity,
    neededBy,
    budget: optionalText(order.budget, 'budget', 100),
    notes: optionalText(order.notes, 'notes', 1500),
    hasImage: order.hasImage === true,
  };
}

export function buildEnquiryMessage(ideaInput, orderInput = {}) {
  const idea = normalizeIdea(ideaInput);
  const order = readOrder(orderInput);
  const lines = [
    'Hello Eleven Layers Studio! I’d like to discuss a custom 3D printed idea.',
    '',
    'Product: '+TEMPLATES[idea.category].label,
    'My idea: '+idea.rawIdea,
  ];
  for (const field of getTemplateFields(idea.category)) {
    if (idea.details[field.id]) lines.push(field.label+': '+idea.details[field.id]);
  }
  if (order.quantity) lines.push('Quantity: '+order.quantity);
  if (order.neededBy) lines.push('Needed by: '+order.neededBy);
  if (order.budget) lines.push('Approximate budget: '+order.budget);
  if (order.notes) lines.push('', 'Additional notes: '+order.notes);
  lines.push('', order.hasImage
    ? 'I have a concept image or reference to attach in this chat.'
    : 'Please help me explore this idea.');
  lines.push('Could you confirm the design options, feasibility, price, and timing?');
  return lines.join('\n');
}

export function createMessageHandoff(channel, message) {
  if (!Object.hasOwn(CHAT_CHANNELS, channel)) {
    throw new IdeaInputError('Choose WhatsApp or Instagram.', 'channel');
  }
  if (typeof message !== 'string' || !message.trim() || Array.from(message).length > 20000) {
    throw new IdeaInputError('Keep your enquiry between 1 and 20,000 characters.', 'enquiry');
  }
  if (channel === 'instagram') {
    return {
      channel, message, url: CHAT_CHANNELS.instagram.url, copyRequired: true,
      instructions: 'Open the Eleven Layers profile, tap Message, paste your enquiry, and attach a reference image if you have one.',
    };
  }
  const prefilled = CHAT_CHANNELS.whatsapp.url+'?text='+encodeURIComponent(message);
  const copyRequired = prefilled.length > MAX_CHAT_LINK_LENGTH;
  return {
    channel, message, url: copyRequired ? CHAT_CHANNELS.whatsapp.url : prefilled, copyRequired,
    instructions: copyRequired
      ? 'Paste your copied enquiry in WhatsApp, attach a reference image if you have one, then review and send.'
      : 'Review your enquiry in WhatsApp, attach a reference image if you have one, then send.',
  };
}

export function buildChatHandoff(channel, ideaInput, orderInput = {}) {
  return createMessageHandoff(channel, buildEnquiryMessage(ideaInput, orderInput));
}
