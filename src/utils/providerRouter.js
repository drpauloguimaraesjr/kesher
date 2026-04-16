/**
 * 🔀 Provider Router — decide qual provider usar (Z-API ou WHAPI) para cada número
 *
 * Fase 1 da migração:
 *   - Apenas os números listados em WHAPI_PILOT_PHONES (CSV) usam WHAPI.
 *   - Todo o resto segue pelo Z-API (fluxo atual, inalterado).
 *
 * Failsafe:
 *   - Se WHAPI_PILOT_PHONES estiver vazia ou ausente → TUDO vai por Z-API.
 *   - Se o número não for válido → Z-API (comportamento padrão).
 */

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function getPilotPhones() {
  return (process.env.WHAPI_PILOT_PHONES || '')
    .split(',')
    .map((p) => p.trim().replace(/\D/g, ''))
    .filter(Boolean);
}

function getProvider(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return 'zapi';

  const pilotPhones = getPilotPhones();
  if (pilotPhones.length === 0) return 'zapi';

  if (pilotPhones.includes(normalized)) return 'whapi';
  return 'zapi';
}

function isWhapiConfigured() {
  return Boolean(process.env.WHAPI_TOKEN);
}

module.exports = {
  getProvider,
  getPilotPhones,
  normalizePhone,
  isWhapiConfigured,
};
