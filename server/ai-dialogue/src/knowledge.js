// Only the recovered reference is available; it is not a transcript of these characters.
// No author secret, global game state, client-supplied facts or private dialogue enters context.
export const CHARACTERS = Object.freeze({
  jonas: Object.freeze({ id: 'jonas', name: 'يوناس', allowedKnowledge: Object.freeze([]) }),
  claire: Object.freeze({ id: 'claire', name: 'كلير', allowedKnowledge: Object.freeze([]) }),
});
export function buildContext(characterId, received) {
  if (!Object.hasOwn(CHARACTERS, characterId)) throw new Error('unknown_character');
  const context = { characterId, allowed: [...CHARACTERS[characterId].allowedKnowledge] };
  if (received?.actor === characterId && Array.isArray(received.materials)) context.received = received;
  return context;
}
