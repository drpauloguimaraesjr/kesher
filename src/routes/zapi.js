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

module.exports = router;
