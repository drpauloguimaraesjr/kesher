/**
 * 📱 Rotas WHAPI
 *
 * - POST /webhook → recebe eventos do WHAPI (messages.post, statuses.post)
 *                   transforma para o formato unificado do Kesher
 *                   encaminha para o Backend (mesmo endpoint do Z-API)
 * - GET  /webhook → health check
 * - GET  /status  → verifica se o token/canal WHAPI está saudável
 *
 * Observação: o roteamento por número (pilot vs padrão) acontece no send
 * (em src/routes/zapi.js). Este arquivo cuida só do recebimento do WHAPI.
 */

const express = require('express');
const router = express.Router();
const whapiAdapter = require('../services/WhapiAdapter');
const whapiJidMap = require('../services/WhapiJidMap');
const { isWhapiConfigured, getProvider } = require('../utils/providerRouter');

// Destinos dos webhooks (mesmo do Z-API para manter simetria)
const WEBHOOK_DESTINATIONS = [
  process.env.NUTRIBUDDY_WEBHOOK_URL ||
    'https://web-production-c9eaf.up.railway.app/api/whatsapp-kesher/webhook',
];

// ============================================================
// DEDUP — in-memory, TTL por contagem
// ============================================================
const processedMessageIds = new Set();
const MAX_DEDUP_SIZE = 2000;

function markProcessed(id) {
  if (!id) return false;
  if (processedMessageIds.has(id)) return true;
  processedMessageIds.add(id);
  if (processedMessageIds.size > MAX_DEDUP_SIZE) {
    // Trim ~10% dos mais antigos
    const iterator = processedMessageIds.values();
    const toDelete = Math.floor(MAX_DEDUP_SIZE * 0.1);
    for (let i = 0; i < toDelete; i++) {
      const next = iterator.next();
      if (next.done) break;
      processedMessageIds.delete(next.value);
    }
  }
  return false;
}

// ============================================================
// TRANSFORMAÇÃO WHAPI → FORMATO UNIFICADO KESHER
// ============================================================

/**
 * Extrai o número limpo de um chat_id ou campo from.
 * WHAPI usa "5547992567770@s.whatsapp.net" (individual) ou "...@g.us" (grupo).
 */
function extractPhoneFromChatId(chatId) {
  if (!chatId) return '';
  return String(chatId).split('@')[0].replace(/\D/g, '');
}

/**
 * Transforma uma mensagem WHAPI para o payload unificado esperado pelo Backend.
 * Retorna null se não for uma mensagem processável (evento de status, from_me, tipo desconhecido).
 */
function transformWhapiMessage(m, channelId) {
  if (!m || typeof m !== 'object') return null;

  // Ignorar mensagens que nós mesmos enviamos
  if (m.from_me === true) {
    console.log('⏭️ [WHAPI] Mensagem from_me=true ignorada');
    return null;
  }

  const rawType = m.type || 'text';
  let unifiedType = 'text';
  let message = '';
  let mediaUrl = null;
  let thumbnailUrl = null;
  let mimeType = null;

  switch (rawType) {
    case 'text':
    case 'chat': {
      unifiedType = 'text';
      if (typeof m.text === 'string') {
        message = m.text;
      } else if (m.text && typeof m.text === 'object') {
        message = m.text.body || m.text.message || '';
      } else if (typeof m.body === 'string') {
        message = m.body;
      }
      break;
    }
    case 'image': {
      unifiedType = 'image';
      const img = m.image || {};
      mediaUrl = img.link || img.url || null;
      thumbnailUrl = img.preview || img.thumbnail || null;
      mimeType = img.mime_type || 'image/jpeg';
      message = img.caption || m.caption || '';
      break;
    }
    case 'video': {
      unifiedType = 'video';
      const v = m.video || {};
      mediaUrl = v.link || v.url || null;
      thumbnailUrl = v.preview || v.thumbnail || null;
      mimeType = v.mime_type || 'video/mp4';
      message = v.caption || m.caption || '';
      break;
    }
    case 'audio': {
      unifiedType = 'audio';
      const a = m.audio || {};
      mediaUrl = a.link || a.url || null;
      mimeType = a.mime_type || 'audio/ogg';
      break;
    }
    case 'voice':
    case 'ptt': {
      unifiedType = 'ptt';
      const a = m.voice || m.ptt || m.audio || {};
      mediaUrl = a.link || a.url || null;
      mimeType = a.mime_type || 'audio/ogg; codecs=opus';
      break;
    }
    case 'document': {
      unifiedType = 'document';
      const d = m.document || {};
      mediaUrl = d.link || d.url || null;
      mimeType = d.mime_type || 'application/octet-stream';
      message = d.filename || d.caption || '';
      break;
    }
    case 'sticker': {
      unifiedType = 'sticker';
      const s = m.sticker || {};
      mediaUrl = s.link || s.url || null;
      mimeType = s.mime_type || 'image/webp';
      break;
    }
    case 'location': {
      unifiedType = 'location';
      const l = m.location || {};
      message = l.address || l.name || '';
      break;
    }
    case 'contact':
    case 'contacts': {
      unifiedType = 'contact';
      const c = m.contact || (Array.isArray(m.contacts) ? m.contacts[0] : {}) || {};
      message = c.name || c.formatted_name || '';
      break;
    }
    default:
      console.log(`⏭️ [WHAPI] Tipo de mensagem não suportado: ${rawType}`);
      return null;
  }

  const chatId = m.chat_id || m.chatId || '';
  const phone = extractPhoneFromChatId(m.from || chatId);
  const isGroup = String(chatId).endsWith('@g.us');

  // WHAPI envia timestamp em segundos — padronizamos para ISO 8601 (como o Z-API faz)
  let timestampIso;
  if (typeof m.timestamp === 'number') {
    const ms = m.timestamp < 1e12 ? m.timestamp * 1000 : m.timestamp;
    timestampIso = new Date(ms).toISOString();
  } else if (m.timestamp) {
    timestampIso = String(m.timestamp);
  } else {
    timestampIso = new Date().toISOString();
  }

  return {
    phone,
    message,
    messageId: m.id || `whapi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: unifiedType,
    senderName: m.from_name || m.chat_name || m.pushname || 'Desconhecido',
    mediaUrl,
    thumbnailUrl,
    mimeType,
    timestamp: timestampIso,
    senderPhoto: m.from_profile_picture || m.profile_picture || null,
    isGroup,
    _raw: {
      provider: 'whapi',
      chatId,
      channelId,
      type: rawType,
      source: m.source || null,
    },
  };
}

// ============================================================
// ENCAMINHAMENTO
// ============================================================

async function forwardToBackend(payload) {
  return Promise.all(
    WEBHOOK_DESTINATIONS.map(async (url) => {
      try {
        console.log(`🔄 [WHAPI → Backend] encaminhando para: ${url}`);
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const responseText = await response.text();
        console.log(
          `✅ [WHAPI → Backend] ${response.status} ${responseText.slice(0, 200)}`
        );
        return { url, success: response.ok, status: response.status, response: responseText };
      } catch (error) {
        console.error(`❌ [WHAPI → Backend] erro em ${url}:`, error.message);
        return { url, success: false, error: error.message };
      }
    })
  );
}

// ============================================================
// ROTAS
// ============================================================

/**
 * POST /webhook
 *
 * WHAPI manda dois tipos principais de evento no mesmo endpoint:
 *  - messages.post  → nova mensagem recebida (ou enviada por nós, marcada com from_me)
 *  - statuses.post  → atualização de status (sent/delivered/read). IGNORAMOS.
 *
 * O corpo tem shape:
 *   {
 *     "messages": [ {...}, {...} ],            ← no evento messages.post
 *     "statuses": [ {...} ],                   ← no evento statuses.post
 *     "channel_id": "...",
 *     "event": { "type": "messages"|"statuses", "event": "post" }
 *   }
 */
router.post('/webhook', async (req, res) => {
  try {
    const event = req.body || {};
    const channelId = event.channel_id || null;
    const eventType = event.event?.type;
    const eventAction = event.event?.event;

    console.log(
      `📨 [WHAPI Webhook] Evento recebido: ${eventType || 'desconhecido'}/${
        eventAction || '—'
      } (channel: ${channelId || 'n/a'})`
    );

    // Ignorar callbacks de status / delivery / read (não são mensagens)
    if (eventType === 'statuses') {
      console.log('⏭️ [WHAPI] Evento de status ignorado');
      return res.status(200).json({ success: true, message: 'statuses ignorado', forwarded: false });
    }

    // Outros eventos que não são mensagens (presenças de outros, atualizações de chat, etc.)
    const ignoreEventTypes = ['presences', 'chats', 'groups', 'calls', 'labels', 'users'];
    if (ignoreEventTypes.includes(eventType)) {
      console.log(`⏭️ [WHAPI] Evento "${eventType}" ignorado`);
      return res
        .status(200)
        .json({ success: true, message: `evento ${eventType} ignorado`, forwarded: false });
    }

    const messages = Array.isArray(event.messages) ? event.messages : [];
    if (messages.length === 0) {
      console.log('⏭️ [WHAPI] Payload sem mensagens');
      return res.status(200).json({ success: true, message: 'sem mensagens', forwarded: false });
    }

    const results = [];

    for (const m of messages) {
      const id = m && m.id;

      // Dedup (igual ao comportamento do Kesher: reprocessar é ruim)
      if (id && markProcessed(id)) {
        console.log(`⏭️ [WHAPI] Mensagem duplicada ignorada: ${id}`);
        results.push({ messageId: id, dedup: true, forwarded: false });
        continue;
      }

      const payload = transformWhapiMessage(m, channelId);
      if (!payload) {
        results.push({ messageId: id, forwarded: false, reason: 'não processável' });
        continue;
      }

      // 🔀 Roteamento por número: o WHAPI só encaminha mensagens de pacientes
      // que estão em WHAPI_PILOT_PHONES. Qualquer outro número é responsabilidade
      // do Z-API (que recebe em paralelo via multi-device). Evita duplicação.
      const provider = getProvider(payload.phone);
      if (provider !== 'whapi') {
        console.log(
          `⏭️ [WHAPI Webhook] Mensagem de ${payload.phone} ignorada — número não é piloto (vai pelo Z-API)`
        );
        results.push({
          messageId: id,
          forwarded: false,
          reason: 'paciente não é piloto WHAPI — Z-API encaminha'
        });
        continue;
      }

      console.log(
        `📥 [WHAPI Webhook] Mensagem recebida de ${payload.phone} via WHAPI (piloto, tipo: ${payload.type}, sender: ${payload.senderName})`
      );

      // Captura o JID real do paciente: quando ele MANDA, o chat_id é o
      // dele mesmo. Salva nas duas variantes (com e sem 9) pra que o
      // adapter encontre na hora de responder, independente do formato
      // que o Backend usar. Best-effort, não bloqueia.
      const realChatId = payload._raw?.chatId;
      if (realChatId && realChatId.includes('@s.whatsapp.net') && !payload.isGroup) {
        whapiJidMap
          .recordChatId(payload.phone, realChatId, {
            fromName: payload.senderName,
            messageId: payload.messageId,
            channelId: payload._raw?.channelId,
          })
          .then(() =>
            console.log(`🗺️  [WhapiJidMap] mapping salvo: ${payload.phone} → ${realChatId}`)
          )
          .catch((err) =>
            console.error('[WhapiJidMap] erro ao salvar mapping:', err.message)
          );
      }

      const forwardResults = await forwardToBackend(payload);
      results.push({ messageId: id, forwarded: true, forwardResults });
    }

    res.status(200).json({ success: true, processed: results.length, results });
  } catch (error) {
    console.error('❌ [WHAPI Webhook] Erro:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /webhook
 * Health check do webhook WHAPI (alguns serviços fazem GET para validar a URL)
 */
router.get('/webhook', (req, res) => {
  res.json({
    success: true,
    message: 'Kesher WHAPI Webhook está ativo',
    configured: isWhapiConfigured(),
    destinations: WEBHOOK_DESTINATIONS,
    pilotPhones: (process.env.WHAPI_PILOT_PHONES || '').split(',').filter(Boolean),
    expectedFormat: {
      messages: 'array de objetos WHAPI (messages.post)',
      statuses: 'array de objetos de status (statuses.post — ignorado)',
      channel_id: 'id do canal WHAPI',
      event: '{ type, event }',
    },
  });
});

/**
 * POST /webhook/test
 * Simula um webhook WHAPI para testar a transformação sem bater no WHAPI real
 */
router.post('/webhook/test', async (req, res) => {
  try {
    const samplePayload = req.body && Object.keys(req.body).length > 0
      ? req.body
      : {
          channel_id: 'test-channel',
          event: { type: 'messages', event: 'post' },
          messages: [
            {
              id: `test-${Date.now()}`,
              from_me: false,
              type: 'text',
              chat_id: '5547992567770@s.whatsapp.net',
              timestamp: Math.floor(Date.now() / 1000),
              source: 'mobile',
              from: '5547992567770',
              from_name: 'Teste Piloto WHAPI',
              text: { body: 'Mensagem de teste via WHAPI' },
            },
          ],
        };

    const msg = samplePayload.messages?.[0];
    const transformed = transformWhapiMessage(msg, samplePayload.channel_id);

    if (!transformed) {
      return res.json({ success: false, message: 'Payload não transformável', input: samplePayload });
    }

    const results = await forwardToBackend(transformed);

    res.json({
      success: true,
      transformedPayload: transformed,
      forwardResults: results,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /status
 * Verifica se o token WHAPI está válido e o canal está conectado
 */
router.get('/status', async (req, res) => {
  if (!isWhapiConfigured()) {
    return res.status(200).json({
      success: false,
      configured: false,
      error: 'WHAPI_TOKEN não configurado',
    });
  }
  const result = await whapiAdapter.getStatus();
  res.status(result.success ? 200 : 400).json({ configured: true, ...result });
});

module.exports = router;
