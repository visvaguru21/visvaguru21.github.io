export const PROMPT_VERSION = 'eleven-layers-concept/1.0.0';
export const PROVIDER = Object.freeze({ id: 'chatgpt', label: 'ChatGPT', url: 'https://chatgpt.com/' });

export const LIMITS = Object.freeze({
  rawIdea: 4000,
  detail: 500,
  prompt: 20000,
});

export const COMMON_FIELDS = Object.freeze([
  { id: 'size', label: 'Approximate size and units' },
  { id: 'colour', label: 'Colour' },
  { id: 'style', label: 'Visual style' },
  { id: 'personalisation', label: 'Personalisation or exact text' },
  { id: 'mustKeep', label: 'Details that must stay the same' },
  { id: 'avoid', label: 'Things to avoid' },
]);

export const TEMPLATES = Object.freeze({
  miniature: {
    label: 'Miniature or figurine',
    fields: [
      { id: 'subject', label: 'Person, couple, pet, or fictional character' },
      { id: 'pose', label: 'Pose' },
      { id: 'clothing', label: 'Clothing and accessories' },
      { id: 'baseText', label: 'Exact text for the base' },
    ],
    guidance: [
      'Show the complete figure with a stable base and a physically supported pose.',
      'Keep delicate accessories visually connected and robust enough for a studio to assess.',
      'Preserve the customer’s requested clothing, pose, and exact base text.',
    ],
  },
  vase: {
    label: 'Vase or planter',
    fields: [
      { id: 'intendedUse', label: 'Decorative use, dried flowers, plants, or water use' },
      { id: 'opening', label: 'Opening or neck preference' },
      { id: 'surfacePattern', label: 'Surface pattern' },
    ],
    guidance: [
      'Show a coherent vessel with a visible opening and a stable base.',
      'Keep ornamental parts connected to the vessel and clearly show its silhouette.',
      'Treat water use, drainage, material choice, and any liner as requirements for studio review; do not imply tested watertightness.',
    ],
  },
  gift: {
    label: 'Gift or return gift',
    fields: [
      { id: 'occasion', label: 'Occasion' },
      { id: 'recipient', label: 'Recipient or audience' },
      { id: 'giftFunction', label: 'Purpose of the gift' },
    ],
    guidance: [
      'Show one complete gift concept that expresses the customer’s occasion and intended use.',
      'Use a coherent physical form suitable for later modelling, with exact customer text only where requested.',
      'Keep personalization legible and do not introduce extra names, dates, or logos.',
    ],
  },
  accessory: {
    label: 'Desk or home accessory',
    fields: [
      { id: 'function', label: 'What it should hold or do' },
      { id: 'fittingDimensions', label: 'Dimensions of anything it must fit' },
      { id: 'mounting', label: 'How it stands, hangs, or attaches' },
    ],
    guidance: [
      'Show the functional opening, holder, or attachment clearly.',
      'Use the customer’s fitting measurements exactly; do not invent an interface size or a load rating.',
      'Show a stable and physically coherent object for the studio to assess.',
    ],
  },
  custom: {
    label: 'Original custom idea',
    fields: [
      { id: 'purpose', label: 'What the object is for' },
      { id: 'features', label: 'Important functional or visual features' },
    ],
    guidance: [
      'Preserve the original idea and show one coherent physical object.',
      'Make the requested functional and visual features clearly visible.',
      'Identify critical ambiguities in the object or function before inventing details.',
    ],
  },
});

export const REFERENCE_MODES = Object.freeze(['unspecified', 'will_attach', 'fictional']);
