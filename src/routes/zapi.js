/**
 * 📱 Rotas Z-API
 * Gerenciamento de instâncias via Z-API
 */

const express = require('express');
const router = express.Router();
const zapiManager = require('../services/ZAPIManager');

/**
 * POST /api/zapi/instance/add
 * Adiciona uma instância Z-API existente
 */
router.post('/instance/add', async (req, res) => {
  try {
    const { name, zapiInstanceId, zapiToken } = req.body;

    if (!name || !zapiInstanceId || !zapiToken) {
      return res.status(400).json({
        success: false,
        error: 'name, zapiInstanceId e zapiToken são obrigatórios'
      });
    }

    const result = await zapiManager.addInstance(name, zapiInstanceId, zapiToken);
    res.status(result.success ? 201 : 400).json(result);

  } catch (error) {
    console.error('❌ Erro ao adicionar instância Z-API:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/zapi/instances
 * Lista todas as instâncias
 */
router.get('/instances', async (req, res) => {
  try {
    const instances = await zapiManager.listInstances();
    const stats = await zapiManager.getStats();
    
    res.json({
      success: true,
      stats,
      instances
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/zapi/instance/:name/status
 * Status de uma instância
 */
router.get('/instance/:name/status', async (req, res) => {
  try {
    const result = await zapiManager.getInstanceStatus(req.params.name);
    res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/zapi/instance/:name/qrcode
 * Obtém QR Code de uma instância
 */
router.get('/instance/:name/qrcode', async (req, res) => {
  try {
    const result = await zapiManager.getInstanceQRCode(req.params.name);
    
    // Se o formato solicitado for imagem
    if (req.query.format === 'image' && result.success && result.qrBase64) {
      const base64Data = result.qrBase64.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      res.setHeader('Content-Type', 'image/png');
      return res.send(buffer);
    }

    res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/zapi/instance/:name/restart
 * Reinicia uma instância
 */
router.post('/instance/:name/restart', async (req, res) => {
  try {
    const result = await zapiManager.restartInstance(req.params.name);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/zapi/instance/:name/disconnect
 * Desconecta uma instância
 */
router.post('/instance/:name/disconnect', async (req, res) => {
  try {
    const result = await zapiManager.disconnectInstance(req.params.name);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/zapi/instance/:name
 * Remove uma instância do Manager (não afeta o Z-API)
 */
router.delete('/instance/:name', async (req, res) => {
  try {
    const result = await zapiManager.removeInstance(req.params.name);
    res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/zapi/message/send/text
 * Envia mensagem de texto
 */
router.post('/message/send/text', async (req, res) => {
  try {
    const { instanceId, phone, message } = req.body;

    if (!instanceId || !phone || !message) {
      return res.status(400).json({
        success: false,
        error: 'instanceId, phone e message são obrigatórios'
      });
    }

    const result = await zapiManager.sendTextMessage(instanceId, phone, message);
    res.status(result.success ? 200 : 400).json(result);

  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/zapi/message/send/image
 * Envia imagem
 */
router.post('/message/send/image', async (req, res) => {
  try {
    const { instanceId, phone, imageUrl, caption } = req.body;

    if (!instanceId || !phone || !imageUrl) {
      return res.status(400).json({
        success: false,
        error: 'instanceId, phone e imageUrl são obrigatórios'
      });
    }

    const result = await zapiManager.sendImageMessage(instanceId, phone, imageUrl, caption);
    res.status(result.success ? 200 : 400).json(result);

  } catch (error) {
    console.error('❌ Erro ao enviar imagem:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/zapi/message/send/audio
 * Envia áudio
 */
router.post('/message/send/audio', async (req, res) => {
  try {
    const { instanceId, phone, audioUrl } = req.body;

    if (!instanceId || !phone || !audioUrl) {
      return res.status(400).json({
        success: false,
        error: 'instanceId, phone e audioUrl são obrigatórios'
      });
    }

    const result = await zapiManager.sendAudioMessage(instanceId, phone, audioUrl);
    res.status(result.success ? 200 : 400).json(result);

  } catch (error) {
    console.error('❌ Erro ao enviar áudio:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/zapi/message/send/document
 * Envia documento
 */
router.post('/message/send/document', async (req, res) => {
  try {
    const { instanceId, phone, documentUrl, filename } = req.body;

    if (!instanceId || !phone || !documentUrl) {
      return res.status(400).json({
        success: false,
        error: 'instanceId, phone e documentUrl são obrigatórios'
      });
    }

    const result = await zapiManager.sendDocumentMessage(instanceId, phone, documentUrl, filename);
    res.status(result.success ? 200 : 400).json(result);

  } catch (error) {
    console.error('❌ Erro ao enviar documento:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// WEBHOOKS - Recebe eventos do Z-API e repassa para apps
// ============================================================

// URLs dos apps que devem receber os webhooks
const WEBHOOK_DESTINATIONS = [
  process.env.NUTRIBUDDY_WEBHOOK_URL || 'https://web-production-c9eaf.up.railway.app/api/whatsapp-kesher/webhook'
];

// ============================================================
// SISTEMA DE LOGS EM MEMÓRIA
// ============================================================
const MESSAGE_LOGS = [];
const MAX_LOGS = 100;

function addMessageLog(log) {
  MESSAGE_LOGS.unshift({
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    ...log
  });
  // Manter apenas os últimos MAX_LOGS
  if (MESSAGE_LOGS.length > MAX_LOGS) {
    MESSAGE_LOGS.pop();
  }
}

/**
 * GET /api/zapi/logs
 * Retorna os logs de mensagens
 */
router.get('/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const logs = MESSAGE_LOGS.slice(0, limit);
  res.json({
    success: true,
    count: logs.length,
    total: MESSAGE_LOGS.length,
    logs
  });
});

/**
 * DELETE /api/zapi/logs
 * Limpa os logs
 */
router.delete('/logs', (req, res) => {
  MESSAGE_LOGS.length = 0;
  res.json({ success: true, message: 'Logs limpos' });
});

/**
 * Transforma o payload do Z-API para o formato esperado pelo NutriBuddy
 */
function transformZAPIPayload(zapiEvent) {
  // Log do evento original para debug
  console.log('📥 [Z-API Raw Event]:', JSON.stringify(zapiEvent, null, 2));

  // Ignorar callbacks de status de entrega (não são mensagens)
  const ignoreTypes = ['DeliveryCallback', 'MessageStatusCallback', 'SentCallback'];
  if (ignoreTypes.includes(zapiEvent.type)) {
    console.log('⏭️ [Webhook] Evento ignorado (callback de status):', zapiEvent.type);
    return null;
  }

  // Verificar se é um evento de conexão/desconexão (não é mensagem)
  if (zapiEvent.event === 'status' || zapiEvent.event === 'connection') {
    console.log('⏭️ [Webhook] Evento ignorado (evento de conexão):', zapiEvent.event);
    return null;
  }

  // Não processar mensagens enviadas por nós mesmos
  if (zapiEvent.isFromMe === true || zapiEvent.fromMe === true) {
    console.log('⏭️ [Webhook] Mensagem enviada por mim, ignorando');
    return null;
  }

  // Verificar se é uma mensagem (tem conteúdo de texto ou mídia)
  const hasText = zapiEvent.text;
  const hasImage = zapiEvent.image;
  const hasAudio = zapiEvent.audio;
  const hasVideo = zapiEvent.video;
  const hasDocument = zapiEvent.document;
  const hasSticker = zapiEvent.sticker;
  const hasVoice = zapiEvent.ptt || zapiEvent.ptv; // PTT = Push To Talk (áudio de voz)

  const isMessage = hasText || hasImage || hasAudio || hasVideo || hasDocument || hasSticker || hasVoice;
  
  if (!isMessage) {
    console.log('⏭️ [Webhook] Evento ignorado (não é mensagem):', zapiEvent.type || 'unknown');
    return null;
  }

  // Determinar tipo de mensagem e extrair conteúdo
  let type = 'text';
  let message = '';
  let mediaUrl = null;
  let thumbnailUrl = null;
  let mimeType = null;

  if (hasText) {
    type = 'text';
    // O texto pode vir como string ou como objeto
    if (typeof zapiEvent.text === 'object' && zapiEvent.text.message) {
      message = zapiEvent.text.message;
    } else if (typeof zapiEvent.text === 'string') {
      message = zapiEvent.text;
    } else {
      message = String(zapiEvent.text);
    }
  } else if (hasImage) {
    type = 'image';
    message = zapiEvent.image.caption || '';
    mediaUrl = zapiEvent.image.imageUrl || zapiEvent.image.url || null;
    thumbnailUrl = zapiEvent.image.thumbnailUrl || null;
    mimeType = zapiEvent.image.mimeType || 'image/jpeg';
    console.log('🖼️ [Webhook] Imagem recebida:', { mediaUrl, caption: message });
  } else if (hasAudio || hasVoice) {
    type = 'audio';
    const audioData = zapiEvent.audio || zapiEvent.ptt || zapiEvent.ptv || {};
    mediaUrl = audioData.audioUrl || audioData.url || null;
    mimeType = audioData.mimeType || 'audio/ogg';
    console.log('🎵 [Webhook] Áudio recebido:', { mediaUrl });
  } else if (hasVideo) {
    type = 'video';
    message = zapiEvent.video.caption || '';
    mediaUrl = zapiEvent.video.videoUrl || zapiEvent.video.url || null;
    thumbnailUrl = zapiEvent.video.thumbnailUrl || null;
    mimeType = zapiEvent.video.mimeType || 'video/mp4';
    console.log('🎬 [Webhook] Vídeo recebido:', { mediaUrl, caption: message });
  } else if (hasDocument) {
    type = 'document';
    mediaUrl = zapiEvent.document.documentUrl || zapiEvent.document.url || null;
    mimeType = zapiEvent.document.mimeType || 'application/octet-stream';
    message = zapiEvent.document.fileName || zapiEvent.document.caption || '';
    console.log('📄 [Webhook] Documento recebido:', { mediaUrl, fileName: message });
  } else if (hasSticker) {
    type = 'sticker';
    mediaUrl = zapiEvent.sticker.stickerUrl || zapiEvent.sticker.url || null;
    console.log('🎨 [Webhook] Sticker recebido:', { mediaUrl });
  }

  // Extrair número do telefone (remover sufixos do WhatsApp)
  let phone = zapiEvent.phone || zapiEvent.from || zapiEvent.chatId || '';
  phone = phone.toString().replace('@s.whatsapp.net', '').replace('@c.us', '').replace('@g.us', '');

  // Montar payload no formato esperado pelo NutriBuddy
  const payload = {
    phone: phone,
    message: message,
    messageId: zapiEvent.messageId || zapiEvent.id || `msg-${Date.now()}`,
    type: type,
    senderName: zapiEvent.senderName || zapiEvent.pushName || zapiEvent.notifyName || zapiEvent.chatName || 'Desconhecido',
    mediaUrl: mediaUrl,
    thumbnailUrl: thumbnailUrl,
    mimeType: mimeType,
    timestamp: zapiEvent.momment || zapiEvent.timestamp || new Date().toISOString(),
    // Dados extras
    senderPhoto: zapiEvent.senderPhoto || zapiEvent.photo || null,
    isGroup: zapiEvent.isGroup || false,
    _raw: {
      chatId: zapiEvent.chatId,
      instanceId: zapiEvent.instanceId,
      connectedPhone: zapiEvent.connectedPhone
    }
  };

  console.log('📤 [Payload Transformado]:', JSON.stringify(payload, null, 2));
  return payload;
}

/**
 * POST /api/zapi/webhook
 * Recebe webhooks do Z-API e repassa para os apps configurados
 */
router.post('/webhook', async (req, res) => {
  try {
    const event = req.body;
    
    console.log(`📨 [Kesher Webhook] Evento recebido de Z-API`);

    // Transformar payload do Z-API para formato NutriBuddy
    const transformedPayload = transformZAPIPayload(event);

    // Se não for uma mensagem válida, apenas confirmar recebimento
    if (!transformedPayload) {
      return res.status(200).json({
        success: true,
        message: 'Evento recebido (não é mensagem processável)',
        forwarded: false
      });
    }

    // Repassa para todos os destinos configurados
    const forwardPromises = WEBHOOK_DESTINATIONS.map(async (url) => {
      try {
        console.log(`🔄 [Kesher] Encaminhando para: ${url}`);
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(transformedPayload)
        });
        const responseText = await response.text();
        console.log(`✅ [Kesher Webhook] Resposta de ${url}: ${response.status} - ${responseText}`);
        return { url, success: response.ok, status: response.status, response: responseText };
      } catch (error) {
        console.error(`❌ [Kesher Webhook] Erro ao repassar para ${url}:`, error.message);
        return { url, success: false, error: error.message };
      }
    });

    const results = await Promise.all(forwardPromises);

    // Registrar no log de mensagens
    addMessageLog({
      direction: 'received',
      phone: transformedPayload.phone,
      message: transformedPayload.message,
      type: transformedPayload.type,
      mediaUrl: transformedPayload.mediaUrl,
      senderName: transformedPayload.senderName,
      messageId: transformedPayload.messageId,
      status: results.every(r => r.success) ? 'delivered' : 'failed',
      forwardedTo: results.map(r => ({ url: r.url, status: r.status }))
    });

    // Responde ao Z-API que recebeu com sucesso
    res.status(200).json({
      success: true,
      message: 'Webhook processado e encaminhado',
      forwarded: results
    });

  } catch (error) {
    console.error('❌ [Kesher Webhook] Erro:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/zapi/webhook/test
 * Endpoint de teste para simular webhook do Z-API
 */
router.post('/webhook/test', async (req, res) => {
  try {
    const testPayload = req.body || {
      phone: '5547992727770',
      text: 'Mensagem de teste',
      messageId: `test-${Date.now()}`,
      senderName: 'Teste Manual',
      isFromMe: false
    };

    console.log('🧪 [Teste Webhook] Simulando evento:', testPayload);

    // Chamar o webhook normal internamente
    const transformed = transformZAPIPayload(testPayload);
    
    if (!transformed) {
      return res.json({ success: false, message: 'Payload não transformável' });
    }

    // Enviar para os destinos
    const results = [];
    for (const url of WEBHOOK_DESTINATIONS) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(transformed)
        });
        const text = await response.text();
        results.push({ url, status: response.status, response: text });
      } catch (err) {
        results.push({ url, error: err.message });
      }
    }

    res.json({
      success: true,
      transformedPayload: transformed,
      forwardResults: results
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/zapi/webhook
 * Verificação de saúde do webhook (alguns serviços fazem GET para verificar)
 */
router.get('/webhook', (req, res) => {
  res.json({
    success: true,
    message: 'Kesher Webhook está ativo',
    destinations: WEBHOOK_DESTINATIONS,
    expectedFormat: {
      phone: 'string - número do remetente',
      message: 'string - texto da mensagem',
      messageId: 'string - ID único da mensagem',
      type: 'string - text/image/audio/document/video',
      senderName: 'string - nome do remetente',
      mediaUrl: 'string|null - URL da mídia se houver'
    }
  });
});

module.exports = router;


