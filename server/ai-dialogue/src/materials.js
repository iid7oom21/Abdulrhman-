import { randomUUID } from 'node:crypto';

// Internal game actions only. Callers must authenticate the session and restrict which
// kinds a player may create; a model reply is never an input to this event engine.
export const MATERIAL_TYPES = Object.freeze([
  'statement', 'correction', 'motive', 'private_note', 'evidence', 'report', 'receipt',
]);

const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
const own = (value, key) => Object.hasOwn(value, key);
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

export class MaterialError extends Error {
  constructor(code) { super(code); this.name = 'MaterialError'; this.code = code; }
}
const fail = code => { throw new MaterialError(code); };

export function createMaterialStore({ actors = ['player', 'jonas', 'claire', 'matteo', 'elena'] } = {}) {
  if (!Array.isArray(actors) || !actors.length || actors.some(actor => !validId(actor)) ||
      new Set(actors).size !== actors.length) fail('invalid_actors');
  const known = new Map(actors.map(actor => [actor, new Set()]));
  const materials = new Map();
  const creationPayloads = new Map();
  const revisions = new Map();
  const shares = new Map();
  const sourceGroups = new Map(actors.map(actor => [actor, new Map()]));
  const actorExists = actor => { if (!known.has(actor)) fail('unknown_actor'); };
  const requireKnown = (actor, id) => {
    if (!validId(id) || !known.get(actor).has(id)) fail('material_unavailable');
    return materials.get(id);
  };

  function createMaterial(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail('invalid_material');
    const { type, text } = input;
    const author = input.author ?? 'player';
    actorExists(author);
    if (!MATERIAL_TYPES.includes(type) || typeof text !== 'string' || !text.trim() || text.length > 8000) {
      fail('invalid_material');
    }
    const id = input.id === undefined ? randomUUID() : input.id;
    if (!validId(id)) fail('invalid_material_id');
    const relationKeys = {
      statement: [], correction: ['originalId'], motive: ['originalId'], private_note: [],
      evidence: ['sourceId'], report: ['attachments'], receipt: ['reportId', 'depositId'],
    }[type];
    const allowedKeys = new Set(['id', 'type', 'text', 'author', ...relationKeys]);
    if (Object.keys(input).some(key => !allowedKeys.has(key))) fail('unexpected_material_field');
    const normalized = { id, type, text, author };
    for (const key of relationKeys) {
      if (own(input, key)) normalized[key] = input[key];
    }
    // Canonical shape is chosen by the engine; IDs may replay only this exact action.
    // Revision/creation order never comes from a client's delivery timestamp.
    if (type === 'report' && !own(normalized, 'attachments')) normalized.attachments = [];
    const signature = JSON.stringify(normalized);
    if (materials.has(id)) {
      if (creationPayloads.get(id) !== signature) fail('material_id_conflict');
      return materials.get(id);
    }

    if (type === 'correction' || (type === 'motive' && own(normalized, 'originalId'))) {
      const original = requireKnown(author, normalized.originalId);
      if (original.type !== 'statement' || original.author !== author) fail('invalid_original');
    }
    if (type === 'evidence' && !validId(normalized.sourceId)) fail('invalid_source');
    if (type === 'report') {
      const attachments = normalized.attachments;
      if (!Array.isArray(attachments) || attachments.length > 100 ||
          new Set(attachments).size !== attachments.length) fail('invalid_attachments');
      attachments.forEach(attachment => requireKnown(author, attachment));
      // Copy input arrays so callers cannot mutate an existing report later.
      normalized.attachments = [...attachments];
    }
    if (type === 'receipt') {
      const report = requireKnown(author, normalized.reportId);
      if (report.type !== 'report' || !validId(normalized.depositId)) fail('invalid_receipt');
    }

    const record = { ...normalized };
    if (type === 'correction') {
      record.revision = (revisions.get(record.originalId) || 0) + 1;
      revisions.set(record.originalId, record.revision);
    }
    if (['statement', 'correction', 'motive', 'private_note'].includes(type)) record.epistemicStatus = 'reported';
    if (type === 'report') record.status = 'draft';
    // A source material/receipt is an internal registration, never a new global fact.
    materials.set(id, freeze(record));
    creationPayloads.set(id, signature);
    known.get(author).add(id);
    return materials.get(id);
  }

  function share({ eventId, sender = 'player', materialId, recipients } = {}) {
    actorExists(sender);
    if (!validId(eventId) || !Array.isArray(recipients) || !recipients.length ||
        recipients.length > actors.length || new Set(recipients).size !== recipients.length) fail('invalid_share');
    recipients.forEach(actorExists);
    const material = requireKnown(sender, materialId);
    // Recipient ordering does not change the meaning of an otherwise identical event.
    const recipientSet = [...recipients].sort();
    const signature = JSON.stringify({ sender, materialId, recipients: recipientSet });
    const previous = shares.get(eventId);
    if (previous) {
      if (previous.signature !== signature) fail('share_id_conflict');
      return freeze({ ...previous.event, duplicated: true });
    }
    const deliveredIds = [material.id, ...(material.type === 'report' ? material.attachments : [])];
    // An actor who received a report without its nested attachments cannot forward
    // those unknown attachments. Validate the whole action before any delivery.
    deliveredIds.forEach(id => requireKnown(sender, id));
    for (const recipient of recipientSet) {
      for (const id of deliveredIds) known.get(recipient).add(id);
    }
    const event = freeze({ eventId, sender, materialId, recipients: recipientSet, deliveredIds: [...deliveredIds] });
    shares.set(eventId, { signature, event });
    return freeze({ ...event, duplicated: false });
  }

  function contextFor(actor, { visibleTo } = {}) {
    actorExists(actor);
    if (visibleTo !== undefined) actorExists(visibleTo);
    const received = new Set([...known.get(actor)].filter(id => visibleTo === undefined || known.get(visibleTo).has(id)));
    const latest = new Map();
    for (const id of received) {
      const material = materials.get(id);
      if (material.type === 'correction' &&
          (!latest.has(material.originalId) || latest.get(material.originalId).revision < material.revision)) {
        latest.set(material.originalId, material);
      }
    }
    const projected = [...received].map(id => {
      const material = materials.get(id);
      // Author is the speaker of the material, not the transport sender. Delivery
      // events, other recipients, hidden reference IDs and revision counts stay private.
      const out = { id, type: material.type, text: material.text, author: material.author };
      if (material.epistemicStatus) out.epistemicStatus = material.epistemicStatus;
      if (material.status) out.status = material.status;
      if (material.originalId && received.has(material.originalId)) out.originalId = material.originalId;
      if (material.type === 'correction') out.isLatestKnownCorrection = latest.get(material.originalId).id === id;
      if (material.type === 'evidence') {
        const groupKey = visibleTo === undefined ? actor : `${actor}:${visibleTo}`;
        if (!sourceGroups.has(groupKey)) sourceGroups.set(groupKey, new Map());
        const groups = sourceGroups.get(groupKey);
        if (!groups.has(material.sourceId)) groups.set(material.sourceId, `source-${groups.size + 1}`);
        out.sourceGroup = groups.get(material.sourceId);
      }
      if (material.type === 'report') out.attachments = material.attachments.filter(attachment => received.has(attachment));
      if (material.type === 'receipt' && received.has(material.reportId)) out.reportId = material.reportId;
      return out;
    });
    return freeze({ actor, materials: projected, latestCorrections: [...latest.values()].map(material => material.id) });
  }

  function listMaterials(actor = 'player') { return contextFor(actor).materials; }
  function listShareEvents(actor = 'player') {
    actorExists(actor);
    // A recipient learning a material does not thereby learn other deliveries.
    return freeze([...shares.values()].filter(({ event }) => event.sender === actor).map(({ event }) => event));
  }

  return Object.freeze({ createMaterial, share, contextFor, listMaterials, listShareEvents });
}
