/**
 * 🎛️ Z-API Manager - Kesher API
 * Gerencia instâncias via Z-API (substitui Baileys)
 */

const ZAPIAdapter = require('./ZAPIAdapter');
const { getDb } = require('../config/firebase');

class ZAPIManager {
  constructor() {
    // Map de instâncias: instanceId -> { adapter, metadata }
    this.instances = new Map();
    
    console.log('🕎 [Kesher] Z-API Manager inicializado');
  }

  /**
   * Adiciona uma instância Z-API existente
   */
  async addInstance(name, zapiInstanceId, zapiToken) {
    if (this.instances.has(name)) {
      return {
        success: false,
        error: 'Instância com esse nome já existe'
      };
    }

    const adapter = new ZAPIAdapter(zapiInstanceId, zapiToken);
    
    // Verifica se a instância Z-API está acessível
    const status = await adapter.getStatus();
    
    this.instances.set(name, {
      adapter,
      zapiInstanceId,
      zapiToken,
      name,
      createdAt: new Date().toISOString()
    });

    // Salva no Firestore
    await this.saveInstanceToFirestore(name, zapiInstanceId, zapiToken);

    console.log(`✅ [Z-API Manager] Instância "${name}" adicionada. Total: ${this.instances.size}`);

    return {
      success: true,
      instanceId: name,
      connected: status.connected,
      status
    };
  }

  /**
   * Obtém instância por nome
   */
  getInstance(name) {
    return this.instances.get(name);
  }

  /**
   * Lista todas as instâncias
   */
  async listInstances() {
    const list = [];

    for (const [name, instance] of this.instances) {
      const status = await instance.adapter.getStatus();
      
      list.push({
        instanceId: name,
        zapiInstanceId: instance.zapiInstanceId,
        connected: status.connected,
        smartphoneConnected: status.smartphoneConnected,
        state: status.connected ? 'connected' : 'disconnected',
        createdAt: instance.createdAt
      });
    }

    return list;
  }

  /**
   * Status de uma instância
   */
  async getInstanceStatus(name) {
    const instance = this.instances.get(name);
    
    if (!instance) {
      return { success: false, error: 'Instância não encontrada' };
    }

    const status = await instance.adapter.getStatus();
    
    return {
      success: true,
      instanceId: name,
      connected: status.connected,
      smartphoneConnected: status.smartphoneConnected,
      state: status.connected ? 'connected' : 'disconnected',
      user: null, // Z-API não retorna isso diretamente
      webhooksCount: 0
    };
  }

  /**
   * QR Code de uma instância
   */
  async getInstanceQRCode(name) {
    const instance = this.instances.get(name);
    
    if (!instance) {
      return { success: false, error: 'Instância não encontrada' };
    }

    // Primeiro tenta pegar a imagem direta
    const qrResult = await instance.adapter.getQRCodeImage();
    
    if (qrResult.success) {
      return {
        success: true,
        available: true,
        qrBase64: qrResult.qrBase64
      };
    }

    // Se não conseguir, tenta o método alternativo
    const qrBase64 = await instance.adapter.getQRCode();
    
    if (qrBase64.success) {
      return {
        success: true,
        available: true,
        qrBase64: qrBase64.qrBase64
      };
    }

    return {
      success: false,
      available: false,
      error: 'QR Code não disponível. A instância pode já estar conectada.'
    };
  }

  /**
   * Envia mensagem de texto
   */
  async sendTextMessage(name, phone, text) {
    const instance = this.instances.get(name);
    
    if (!instance) {
      return { success: false, error: 'Instância não encontrada' };
    }

    return await instance.adapter.sendTextMessage(phone, text);
  }

  /**
   * Envia imagem
   */
  async sendImageMessage(name, phone, imageUrl, caption = '') {
    const instance = this.instances.get(name);
    
    if (!instance) {
      return { success: false, error: 'Instância não encontrada' };
    }

    return await instance.adapter.sendImageMessage(phone, imageUrl, caption);
  }

  /**
   * Envia documento
   */
  async sendDocumentMessage(name, phone, documentUrl, filename) {
    const instance = this.instances.get(name);
    
    if (!instance) {
      return { success: false, error: 'Instância não encontrada' };
    }

    return await instance.adapter.sendDocumentMessage(phone, documentUrl, filename);
  }

  /**
   * Envia áudio
   */
  async sendAudioMessage(name, phone, audioUrl) {
    const instance = this.instances.get(name);
    
    if (!instance) {
      return { success: false, error: 'Instância não encontrada' };
    }

    return await instance.adapter.sendAudioMessage(phone, audioUrl);
  }

  /**
   * Envia chat-status (typing / recording / pause)
   */
  async sendChatStatus(name, phone, presence) {
    const instance = this.instances.get(name);

    if (!instance) {
      return { success: false, error: 'Instância não encontrada' };
    }

    return await instance.adapter.sendChatStatus(phone, presence);
  }

  /**
   * Reinicia uma instância
   */
  async restartInstance(name) {
    const instance = this.instances.get(name);
    
    if (!instance) {
      return { success: false, error: 'Instância não encontrada' };
    }

    return await instance.adapter.restart();
  }

  /**
   * Desconecta uma instância
   */
  async disconnectInstance(name) {
    const instance = this.instances.get(name);
    
    if (!instance) {
      return { success: false, error: 'Instância não encontrada' };
    }

    return await instance.adapter.disconnect();
  }

  /**
   * Remove uma instância (apenas do manager, não do Z-API)
   */
  async removeInstance(name) {
    const instance = this.instances.get(name);
    
    if (!instance) {
      return { success: false, error: 'Instância não encontrada' };
    }

    this.instances.delete(name);
    await this.removeInstanceFromFirestore(name);

    console.log(`🗑️ [Z-API Manager] Instância "${name}" removida. Total: ${this.instances.size}`);

    return { success: true, message: 'Instância removida' };
  }

  /**
   * Salva instância no Firestore
   */
  async saveInstanceToFirestore(name, zapiInstanceId, zapiToken) {
    try {
      const db = getDb();
      await db.collection('zapi-instances').doc(name).set({
        name,
        zapiInstanceId,
        zapiToken,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log(`💾 [Z-API Manager] Instância "${name}" salva no Firestore`);
    } catch (error) {
      console.error(`❌ [Z-API Manager] Erro ao salvar no Firestore:`, error);
    }
  }

  /**
   * Remove instância do Firestore
   */
  async removeInstanceFromFirestore(name) {
    try {
      const db = getDb();
      await db.collection('zapi-instances').doc(name).delete();
    } catch (error) {
      console.error(`❌ [Z-API Manager] Erro ao remover do Firestore:`, error);
    }
  }

  /**
   * Carrega instâncias do Firestore
   */
  async loadExistingInstances() {
    try {
      const db = getDb();
      const snapshot = await db.collection('zapi-instances').get();
      
      console.log(`📂 [Z-API Manager] Carregando ${snapshot.size} instâncias...`);

      for (const doc of snapshot.docs) {
        const { name, zapiInstanceId, zapiToken } = doc.data();
        
        if (!this.instances.has(name)) {
          await this.addInstance(name, zapiInstanceId, zapiToken);
        }
      }

      console.log(`✅ [Z-API Manager] ${snapshot.size} instâncias carregadas`);
    } catch (error) {
      console.error('❌ [Z-API Manager] Erro ao carregar instâncias:', error);
    }
  }

  /**
   * Estatísticas gerais
   */
  async getStats() {
    let connected = 0;
    let disconnected = 0;

    for (const [, instance] of this.instances) {
      const status = await instance.adapter.getStatus();
      if (status.connected) connected++;
      else disconnected++;
    }

    return {
      total: this.instances.size,
      connected,
      disconnected,
      waitingQR: 0
    };
  }
}

// Singleton
const zapiManager = new ZAPIManager();

module.exports = zapiManager;
