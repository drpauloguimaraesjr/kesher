/**
 * 🗺️  WhapiJidMap — mapeamento dinâmico phone_normalizado → chat_id real
 *
 * Por que existe:
 *   O WhatsApp Brasil tem dois JIDs possíveis para o mesmo paciente:
 *     - 13 dígitos (com nono dígito):  5547992567770@s.whatsapp.net
 *     - 12 dígitos (formato antigo):   554792567770@s.whatsapp.net
 *
 *   Cada paciente está registrado em UM dos dois JIDs (depende de quando
 *   ele criou a conta WhatsApp). Mensagens enviadas pro JID errado ficam
 *   presas em status=sent eternamente, sem virar delivered.
 *
 *   O Backend chama o Kesher com o phone do CADASTRO do paciente (sempre
 *   13 dígitos com 9). Mas o JID real pode ser de 12 dígitos.
 *
 * Como funciona:
 *   1. Quando uma mensagem chega via WHAPI webhook, capturamos o chat_id
 *      EXATO usado pelo paciente (essa é a fonte da verdade).
 *   2. Salvamos em Firestore + cache local: ambas variantes do phone
 *      (com e sem 9) apontando para o mesmo chat_id real.
 *   3. Antes de enviar via WHAPI, o adapter consulta o mapping.
 *      Se houver entrada, usa o chat_id literal (skip formatPhone).
 *      Se não houver, usa o número formatado (comportamento atual).
 *
 *   Resultado: respostas sempre caem na mesma conversa onde o paciente
 *   enviou. Sem configuração manual por paciente.
 *
 * Cache local:
 *   - Map em memória, TTL de 30 min.
 *   - Lookup primeiro no cache, depois Firestore.
 *   - Se Firestore falhar, cai no comportamento padrão (sem mapping).
 */

const { getDb } = require('../config/firebase');

const COLLECTION = 'whapi_jid_map';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

const cache = new Map(); // phone -> { chatId, expiresAt }

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

/**
 * Gera as duas variantes BR do mesmo número (com e sem o nono dígito).
 * Para números fora do padrão BR, retorna só o original.
 */
function phoneVariants(phone) {
  const normalized = normalizePhone(phone);
  const variants = new Set([normalized]);

  if (normalized.startsWith('55') && normalized.length === 13) {
    // 55 + DDD + 9 + 8 dígitos → variante: remove o 9
    const ddd = normalized.substring(2, 4);
    const numComNove = normalized.substring(4); // 9XXXXYYYY
    if (numComNove.startsWith('9')) {
      variants.add(`55${ddd}${numComNove.substring(1)}`);
    }
  } else if (normalized.startsWith('55') && normalized.length === 12) {
    // 55 + DDD + 8 dígitos → variante: insere o 9
    const ddd = normalized.substring(2, 4);
    const num = normalized.substring(4);
    variants.add(`55${ddd}9${num}`);
  }

  return Array.from(variants).filter(Boolean);
}

function cachePut(phone, chatId) {
  cache.set(phone, { chatId, expiresAt: Date.now() + CACHE_TTL_MS });
}

function cacheGet(phone) {
  const entry = cache.get(phone);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(phone);
    return null;
  }
  return entry.chatId;
}

/**
 * Salva o chat_id real do paciente em todas as variantes do phone.
 * Idempotente — chama no recebimento de toda mensagem WHAPI inbound.
 */
async function recordChatId(phone, chatId, metadata = {}) {
  if (!chatId || !String(chatId).includes('@')) return;

  const variants = phoneVariants(phone);
  if (variants.length === 0) return;

  // Atualiza cache imediatamente (sem esperar Firestore)
  variants.forEach((v) => cachePut(v, chatId));

  // Persiste no Firestore (best-effort, não bloqueia)
  try {
    const db = getDb();
    if (!db) return;

    const batch = db.batch();
    const now = Date.now();
    variants.forEach((v) => {
      const ref = db.collection(COLLECTION).doc(v);
      batch.set(
        ref,
        {
          chatId,
          phoneVariants: variants,
          lastSeenAt: now,
          fromName: metadata.fromName || null,
          sourceMessageId: metadata.messageId || null,
          channelId: metadata.channelId || null,
        },
        { merge: true }
      );
    });
    await batch.commit();
  } catch (error) {
    console.error('[WhapiJidMap] erro ao gravar no Firestore:', error.message);
  }
}

/**
 * Procura o chat_id real para um phone.
 * Lookup: cache → Firestore (com fallback para a variante).
 * Retorna null se não houver mapping (caller deve usar formatPhone padrão).
 */
async function lookup(phone) {
  const variants = phoneVariants(phone);

  // 1) Cache hit em qualquer variante
  for (const v of variants) {
    const hit = cacheGet(v);
    if (hit) return hit;
  }

  // 2) Firestore
  try {
    const db = getDb();
    if (!db) return null;

    for (const v of variants) {
      const snap = await db.collection(COLLECTION).doc(v).get();
      if (snap.exists) {
        const chatId = snap.data()?.chatId;
        if (chatId) {
          // Reaquece o cache em todas variantes
          variants.forEach((vv) => cachePut(vv, chatId));
          return chatId;
        }
      }
    }
  } catch (error) {
    console.error('[WhapiJidMap] erro no lookup Firestore:', error.message);
  }

  return null;
}

function clearCache() {
  cache.clear();
}

module.exports = {
  recordChatId,
  lookup,
  phoneVariants,
  normalizePhone,
  clearCache,
};
