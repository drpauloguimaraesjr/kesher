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

/**
 * Transforma o payload do Z-API para o formato esperado pelo NutriBuddy
 */
function transformZAPIPayload(zapiEvent) {
  // Log do evento original para debug
  console.log('📥 [Z-API Raw Event]:', JSON.stringify(zapiEvent, null, 2));

  // Z-API envia diferentes tipos de eventos
  // Evento de mensagem recebida tem a estrutura:
  // { phone, text, messageId, isFromMe, senderName, etc }
  
  // Se for evento de status (conectado/desconectado), ignorar
  if (zapiEvent.status || zapiEvent.event === 'status') {
    return null;
  }

  // Verificar se é uma mensagem
  const isMessage = zapiEvent.text || zapiEvent.image || zapiEvent.audio || zapiEvent.document || zapiEvent.video;
  
  if (!isMessage) {
    console.log('⏭️ [Webhook] Evento ignorado (não é mensagem):', zapiEvent.event || zapiEvent.type);
    return null;
  }

  // Não processar mensagens enviadas por nós mesmos
  if (zapiEvent.isFromMe === true || zapiEvent.fromMe === true) {
    console.log('⏭️ [Webhook] Mensagem enviada por mim, ignorando');
    return null;
  }

  // Determinar tipo de mensagem
  let type = 'text';
  let message = '';
  let mediaUrl = null;

  if (zapiEvent.text) {
    type = 'text';
    message = zapiEvent.text.message || zapiEvent.text || '';
  } else if (zapiEvent.image) {
    type = 'image';
    message = zapiEvent.image.caption || '';
    mediaUrl = zapiEvent.image.imageUrl || zapiEvent.image.url || null;
  } else if (zapiEvent.audio) {
    type = 'audio';
    mediaUrl = zapiEvent.audio.audioUrl || zapiEvent.audio.url || null;
  } else if (zapiEvent.document) {
    type = 'document';
    mediaUrl = zapiEvent.document.documentUrl || zapiEvent.document.url || null;
  } else if (zapiEvent.video) {
    type = 'video';
    mediaUrl = zapiEvent.video.videoUrl || zapiEvent.video.url || null;
  }

  // Extrair número do telefone (remover @s.whatsapp.net se presente)
  let phone = zapiEvent.phone || zapiEvent.from || zapiEvent.chatId || '';
  phone = phone.toString().replace('@s.whatsapp.net', '').replace('@c.us', '');
  
  // Se o texto está em formato diferente
  if (typeof zapiEvent.text === 'object' && zapiEvent.text.message) {
    message = zapiEvent.text.message;
  } else if (typeof zapiEvent.text === 'string') {
    message = zapiEvent.text;
  }

  // Montar payload no formato esperado pelo NutriBuddy
  const payload = {
    phone: phone,
    message: message,
    messageId: zapiEvent.messageId || zapiEvent.id || `msg-${Date.now()}`,
    type: type,
    senderName: zapiEvent.senderName || zapiEvent.pushName || zapiEvent.notifyName || 'Desconhecido',
    mediaUrl: mediaUrl,
    timestamp: zapiEvent.momment || zapiEvent.timestamp || new Date().toISOString(),
    // Dados extras para debug
    _raw: {
      chatId: zapiEvent.chatId,
      instanceId: zapiEvent.instanceId,
      isGroup: zapiEvent.isGroup || false
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


