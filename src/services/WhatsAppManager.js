/**
 * 🎛️ Kesher Manager - קֶשֶׁר
 * Gerencia MÚLTIPLAS instâncias WhatsApp
 * 
 * Este é o "coração" da Kesher API
 */

const WhatsAppInstance = require('./WhatsAppInstance');
const { getDb } = require('../config/firebase');

class WhatsAppManager {
  constructor() {
    // Map de instâncias ativas: instanceId -> WhatsAppInstance
    this.instances = new Map();
    
    console.log('🕎 [Kesher] Manager inicializado');
  }

  /**
   * Cria uma nova instância
   */
  async createInstance(instanceId, options = {}) {
    // Verifica se já existe
    if (this.instances.has(instanceId)) {
      const existing = this.instances.get(instanceId);
      return {
        success: false,
        error: 'Instância já existe',
        status: existing.getStatus()
      };
    }

    // Cria nova instância
    const instance = new WhatsAppInstance(instanceId, {
      onMessage: options.onMessage,
      onStatusChange: (status, data) => {
        console.log(`📊 [Manager] Instância ${instanceId} mudou para ${status}`);
        if (options.onStatusChange) {
          options.onStatusChange(instanceId, status, data);
        }
      }
    });

    // Armazena no Map
    this.instances.set(instanceId, instance);

    // Salva metadata no Firestore
    await this.saveInstanceMetadata(instanceId);

    console.log(`✅ [Manager] Instância ${instanceId} criada. Total: ${this.instances.size}`);

    return {
      success: true,
      instanceId,
      message: 'Instância criada. Use /qrcode para obter o QR Code.'
    };
  }

  /**
   * Conecta uma instância
   */
  async connectInstance(instanceId) {
    const instance = this.instances.get(instanceId);
    
    if (!instance) {
      return { success: false, error: 'Instância não encontrada' };
    }

    return await instance.connect();
  }

  /**
   * Obtém instância por ID
   */
  getInstance(instanceId) {
    return this.instances.get(instanceId);
  }

  /**
   * Lista todas as instâncias
   */
  listInstances() {
    const list = [];
    
    for (const [id, instance] of this.instances) {
      list.push(instance.getStatus());
    }

    return list;
  }

  /**
   * Status de uma instância
   */
  getInstanceStatus(instanceId) {
    const instance = this.instances.get(instanceId);
    
    if (!instance) {
      return { success: false, error: 'Instância não encontrada' };
    }

    return { success: true, ...instance.getStatus() };
  }

  /**
   * QR Code de uma instância
   */
  getInstanceQRCode(instanceId) {
    const instance = this.instances.get(instanceId);
    
    if (!instance) {
      return { success: false, error: 'Instância não encontrada' };
    }

    const qr = instance.getQRCode();
    
    if (!qr.available) {
      return { 
        success: false, 
        error: 'QR Code não disponível. A instância pode estar conectada ou aguardando conexão.',
        state: instance.connectionState
      };
    }

    return { success: true, ...qr };
  }

  /**
   * Envia mensagem de texto
   */
  async sendTextMessage(instanceId, phone, text) {
    const instance = this.instances.get(instanceId);
    
    if (!instance) {
      return { success: false, error: 'Instância não encontrada' };
    }

    try {
      const result = await instance.sendTextMessage(phone, text);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Envia imagem
   */
  async sendImageMessage(instanceId, phone, imageUrl, caption = '') {
    const instance = this.instances.get(instanceId);
    
    if (!instance) {
      return { success: false, error: 'Instância não encontrada' };
    }

    try {
      const result = await instance.sendImageMessage(phone, imageUrl, caption);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Registra webhook em uma instância
   */
  registerWebhook(instanceId, url, events) {
    const instance = this.instances.get(instanceId);
    
    if (!instance) {
      return { success: false, error: 'Instância não encontrada' };
    }

    const webhook = instance.registerWebhook(url, events);
    return { success: true, webhook };
  }

  /**
   * Remove uma instância
   */
  async removeInstance(instanceId, clearSession = false) {
    const instance = this.instances.get(instanceId);
    
    if (!instance) {
      return { success: false, error: 'Instância não encontrada' };
    }

    // Desconecta
    await instance.disconnect();

    // Limpa sessão se solicitado
    if (clearSession) {
      await instance.clearSession();
    }

    // Remove do Map
    this.instances.delete(instanceId);

    // Remove metadata do Firestore
    await this.removeInstanceMetadata(instanceId);

    console.log(`🗑️ [Manager] Instância ${instanceId} removida. Total: ${this.instances.size}`);

    return { success: true, message: 'Instância removida' };
  }

  /**
   * Force reset de uma instância
   */
  async forceResetInstance(instanceId) {
    const instance = this.instances.get(instanceId);
    
    if (!instance) {
      return { success: false, error: 'Instância não encontrada' };
    }

    // Desconecta e limpa
    await instance.disconnect();
    const clearResult = await instance.clearSession();

    // Reconecta
    setTimeout(() => instance.connect(), 2000);

    return { 
      success: true, 
      message: 'Reset iniciado. Aguarde o QR Code.',
      ...clearResult
    };
  }

  /**
   * Salva metadata da instância no Firestore
   */
  async saveInstanceMetadata(instanceId) {
    try {
      const db = getDb();
      await db.collection('whatsapp-instances').doc(instanceId).set({
        instanceId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.error(`❌ [Manager] Erro ao salvar metadata:`, error);
    }
  }

  /**
   * Remove metadata da instância do Firestore
   */
  async removeInstanceMetadata(instanceId) {
    try {
      const db = getDb();
      await db.collection('whatsapp-instances').doc(instanceId).delete();
    } catch (error) {
      console.error(`❌ [Manager] Erro ao remover metadata:`, error);
    }
  }

  /**
   * Carrega instâncias existentes do Firestore (para restart do servidor)
   */
  async loadExistingInstances() {
    try {
      const db = getDb();
      const snapshot = await db.collection('whatsapp-instances').get();
      
      console.log(`📂 [Manager] Carregando ${snapshot.size} instâncias existentes...`);

      for (const doc of snapshot.docs) {
        const { instanceId } = doc.data();
        
        if (!this.instances.has(instanceId)) {
          await this.createInstance(instanceId);
          await this.connectInstance(instanceId);
        }
      }

      console.log(`✅ [Manager] ${snapshot.size} instâncias carregadas`);
    } catch (error) {
      console.error('❌ [Manager] Erro ao carregar instâncias:', error);
    }
  }

  /**
   * Estatísticas gerais
   */
  getStats() {
    let connected = 0;
    let disconnected = 0;
    let waitingQR = 0;

    for (const [, instance] of this.instances) {
      const status = instance.getStatus();
      if (status.connected) connected++;
      else if (status.state === 'qr_ready') waitingQR++;
      else disconnected++;
    }

    return {
      total: this.instances.size,
      connected,
      disconnected,
      waitingQR
    };
  }
}

// Singleton
const manager = new WhatsAppManager();

module.exports = manager;
