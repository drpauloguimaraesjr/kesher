/**
 * 📱 Rotas de Instância
 * Gerenciamento de conexões WhatsApp
 */

const express = require('express');
const router = express.Router();
const manager = require('../services/WhatsAppManager');

/**
 * POST /api/instance/create
 * Cria uma nova instância WhatsApp
 */
router.post('/create', async (req, res) => {
  try {
    const { instanceName } = req.body;

    if (!instanceName) {
      return res.status(400).json({
        success: false,
        error: 'instanceName é obrigatório'
      });
    }

    // Sanitiza o nome (remove caracteres especiais)
    const instanceId = instanceName.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const result = await manager.createInstance(instanceId);

    if (result.success) {
      // Auto-conecta para gerar QR
      await manager.connectInstance(instanceId);
    }

    res.status(result.success ? 201 : 400).json(result);

  } catch (error) {
    console.error('❌ Erro ao criar instância:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/instance/:id/status
 * Status de uma instância
 */
router.get('/:id/status', (req, res) => {
  try {
    const result = manager.getInstanceStatus(req.params.id);
    res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/instance/:id/qrcode
 * Obtém QR Code de uma instância
 */
router.get('/:id/qrcode', (req, res) => {
  try {
    const result = manager.getInstanceQRCode(req.params.id);
    
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
 * POST /api/instance/:id/connect
 * Conecta uma instância
 */
router.post('/:id/connect', async (req, res) => {
  try {
    const result = await manager.connectInstance(req.params.id);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/instance/:id/reset
 * Force reset de uma instância
 */
router.post('/:id/reset', async (req, res) => {
  try {
    const result = await manager.forceResetInstance(req.params.id);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/instance/:id
 * Remove uma instância
 */
router.delete('/:id', async (req, res) => {
  try {
    const clearSession = req.query.clearSession === 'true';
    const result = await manager.removeInstance(req.params.id, clearSession);
    res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/instances
 * Lista todas as instâncias
 */
router.get('/', (req, res) => {
  try {
    const instances = manager.listInstances();
    const stats = manager.getStats();
    
    res.json({
      success: true,
      stats,
      instances
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
