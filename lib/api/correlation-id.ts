export function createCorrelationId(prefix = "req") {
  const generator = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  const id = generator ? generator() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${id}`;
}
