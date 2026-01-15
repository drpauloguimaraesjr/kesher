/**
 * 🔗 Rotas de Webhooks
 * Gerenciamento de webhooks para receber eventos
 */

const express = require('express');
const router = express.Router();
const manager = require('../services/WhatsAppManager');

/**
 * POST /api/webhook/register
 * Registra um novo webhook
 */
router.post('/register', (req, res) => {
  try {
    const { instanceId, url, events } = req.body;

    if (!instanceId || !url) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: instanceId, url'
      });
    }

    // Eventos padrão se não especificados
    const webhookEvents = events || ['message', 'status'];

    const result = manager.registerWebhook(instanceId, url, webhookEvents);
    res.status(result.success ? 201 : 400).json(result);

  } catch (error) {
    console.error('❌ Erro ao registrar webhook:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/webhook/:instanceId
 * Lista webhooks de uma instância
 */
router.get('/:instanceId', (req, res) => {
  try {
    const instance = manager.getInstance(req.params.instanceId);

    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    res.json({
      success: true,
      webhooks: instance.webhooks
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/webhook/:instanceId/:webhookId
 * Remove um webhook
 */
router.delete('/:instanceId/:webhookId', (req, res) => {
  try {
    const instance = manager.getInstance(req.params.instanceId);

    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instância não encontrada'
      });
    }

    const initialLength = instance.webhooks.length;
    instance.webhooks = instance.webhooks.filter(w => w.id !== req.params.webhookId);

    if (instance.webhooks.length === initialLength) {
      return res.status(404).json({
        success: false,
        error: 'Webhook não encontrado'
      });
    }

    res.json({ success: true, message: 'Webhook removido' });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
