/**
 * 💬 Rotas de Mensagens
 * Envio de mensagens via WhatsApp
 */

const express = require('express');
const router = express.Router();
const manager = require('../services/WhatsAppManager');
const { messageLimiter } = require('../middleware/rateLimiter');

// Rate limiting específico para mensagens
router.use(messageLimiter);

/**
 * POST /api/message/send/text
 * Envia mensagem de texto
 */
router.post('/send/text', async (req, res) => {
  try {
    const { instanceId, phone, message } = req.body;

    // Validação
    if (!instanceId || !phone || !message) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: instanceId, phone, message'
      });
    }

    // Sanitiza telefone
    const cleanPhone = phone.replace(/\D/g, '');

    const result = await manager.sendTextMessage(instanceId, cleanPhone, message);
    res.status(result.success ? 200 : 400).json(result);

  } catch (error) {
    console.error('❌ Erro ao enviar texto:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/message/send/image
 * Envia imagem com legenda opcional
 */
router.post('/send/image', async (req, res) => {
  try {
    const { instanceId, phone, imageUrl, caption } = req.body;

    if (!instanceId || !phone || !imageUrl) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: instanceId, phone, imageUrl'
      });
    }

    const cleanPhone = phone.replace(/\D/g, '');

    const result = await manager.sendImageMessage(instanceId, cleanPhone, imageUrl, caption || '');
    res.status(result.success ? 200 : 400).json(result);

  } catch (error) {
    console.error('❌ Erro ao enviar imagem:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/message/send/bulk
 * Envia mensagem em massa (broadcast)
 */
router.post('/send/bulk', async (req, res) => {
  try {
    const { instanceId, phones, message, delay = 2000 } = req.body;

    if (!instanceId || !phones || !Array.isArray(phones) || !message) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: instanceId, phones (array), message'
      });
    }

    const results = {
      total: phones.length,
      success: 0,
      failed: 0,
      details: []
    };

    for (const phone of phones) {
      try {
        const cleanPhone = phone.replace(/\D/g, '');
        await manager.sendTextMessage(instanceId, cleanPhone, message);
        results.success++;
        results.details.push({ phone, status: 'sent' });
        
        // Delay entre mensagens para evitar bloqueio
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (error) {
        results.failed++;
        results.details.push({ phone, status: 'failed', error: error.message });
      }
    }

    res.json({ success: true, results });

  } catch (error) {
    console.error('❌ Erro no broadcast:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
