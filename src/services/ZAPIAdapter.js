/**
 * 🔌 Z-API Adapter para Kesher API
 * Substitui o Baileys pelo Z-API (serviço estável)
 */

class ZAPIAdapter {
  constructor(instanceId, token, clientToken = null) {
    this.instanceId = instanceId;
    this.token = token;
    this.clientToken = clientToken || process.env.ZAPI_CLIENT_TOKEN;
    this.baseUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}`;
  }

  /**
   * Retorna headers padrão com Client-Token
   */
  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.clientToken) {
      headers['Client-Token'] = this.clientToken;
    }
    return headers;
  }

  /**
   * Verifica status da conexão
   */
  async getStatus() {
    try {
      const response = await fetch(`${this.baseUrl}/status`, {
        headers: this.getHeaders()
      });
      const data = await response.json();
      
      return {
        success: true,
        connected: data.connected || false,
        smartphoneConnected: data.smartphoneConnected || false,
        session: data.session || null,
        error: data.error || null
      };
    } catch (error) {
      console.error('[Z-API] Erro ao verificar status:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtém QR Code para conexão
   */
  async getQRCode() {
    try {
      const response = await fetch(`${this.baseUrl}/qr-code`, {
        headers: this.getHeaders()
      });
      const data = await response.json();
      
      if (data.value) {
        return {
          success: true,
          qrCode: data.value,
          qrBase64: `data:image/png;base64,${data.value}`
        };
      }
      
      return { success: false, error: 'QR Code não disponível' };
    } catch (error) {
      console.error('[Z-API] Erro ao obter QR Code:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtém QR Code como imagem (URL)
   */
  async getQRCodeImage() {
    try {
      const response = await fetch(`${this.baseUrl}/qr-code/image`, {
        headers: this.getHeaders()
      });
      
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        return {
          success: true,
          qrBase64: `data:image/png;base64,${base64}`
        };
      }
      
      return { success: false, error: 'QR Code não disponível' };
    } catch (error) {
      console.error('[Z-API] Erro ao obter QR Code:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Desconecta a sessão
   */
  async disconnect() {
    try {
      const response = await fetch(`${this.baseUrl}/disconnect`, {
        method: 'POST',
        headers: this.getHeaders()
      });
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('[Z-API] Erro ao desconectar:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Reinicia a sessão
   */
  async restart() {
    try {
      const response = await fetch(`${this.baseUrl}/restart`, {
        method: 'POST',
        headers: this.getHeaders()
      });
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('[Z-API] Erro ao reiniciar:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envia mensagem de texto
   */
  async sendTextMessage(phone, message) {
    try {
      // Formatar número (remover caracteres especiais, adicionar código país se necessário)
      const formattedPhone = this.formatPhone(phone);
      
      const response = await fetch(`${this.baseUrl}/send-text`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          phone: formattedPhone,
          message: message
        })
      });
      
      const data = await response.json();
      
      return {
        success: !data.error,
        messageId: data.messageId || data.zapiMessageId,
        data
      };
    } catch (error) {
      console.error('[Z-API] Erro ao enviar mensagem:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envia imagem
   */
  async sendImageMessage(phone, imageUrl, caption = '') {
    try {
      const formattedPhone = this.formatPhone(phone);
      
      const response = await fetch(`${this.baseUrl}/send-image`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          phone: formattedPhone,
          image: imageUrl,
          caption: caption
        })
      });
      
      const data = await response.json();
      
      return {
        success: !data.error,
        messageId: data.messageId || data.zapiMessageId,
        data
      };
    } catch (error) {
      console.error('[Z-API] Erro ao enviar imagem:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envia documento
   */
  async sendDocumentMessage(phone, documentUrl, filename = 'document') {
    try {
      const formattedPhone = this.formatPhone(phone);
      
      const response = await fetch(`${this.baseUrl}/send-document/url`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          phone: formattedPhone,
          document: documentUrl,
          fileName: filename
        })
      });
      
      const data = await response.json();
      
      return {
        success: !data.error,
        messageId: data.messageId || data.zapiMessageId,
        data
      };
    } catch (error) {
      console.error('[Z-API] Erro ao enviar documento:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envia áudio
   */
  async sendAudioMessage(phone, audioUrl) {
    try {
      const formattedPhone = this.formatPhone(phone);
      
      const response = await fetch(`${this.baseUrl}/send-audio`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          phone: formattedPhone,
          audio: audioUrl
        })
      });
      
      const data = await response.json();
      
      return {
        success: !data.error,
        messageId: data.messageId || data.zapiMessageId,
        data
      };
    } catch (error) {
      console.error('[Z-API] Erro ao enviar áudio:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envia indicador de chat-status (typing / recording / paused).
   * Z-API endpoint: POST {baseUrl}/send-chat-status
   * Body: { phone, status: "composing" | "recording" | "paused" }
   *
   * Mapeamento do nome genérico (igual ao WHAPI):
   *   typing    → composing
   *   recording → recording
   *   pause     → paused
   */
  async sendChatStatus(phone, presence = 'typing') {
    try {
      const formattedPhone = this.formatPhone(phone);
      const map = { typing: 'composing', recording: 'recording', pause: 'paused' };
      const status = map[presence] || 'composing';

      const response = await fetch(`${this.baseUrl}/send-chat-status`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ phone: formattedPhone, status })
      });

      const data = await response.json().catch(() => ({}));

      return {
        success: !data.error,
        data
      };
    } catch (error) {
      console.error('[Z-API] Erro ao enviar chat-status:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtém informações do contato
   */
  async getContactInfo(phone) {
    try {
      const formattedPhone = this.formatPhone(phone);
      
      const response = await fetch(`${this.baseUrl}/phone-exists/${formattedPhone}`);
      const data = await response.json();
      
      return {
        success: true,
        exists: data.exists || false,
        data
      };
    } catch (error) {
      console.error('[Z-API] Erro ao verificar contato:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtém foto do perfil
   */
  async getProfilePicture(phone) {
    try {
      const formattedPhone = this.formatPhone(phone);
      
      const response = await fetch(`${this.baseUrl}/profile-picture/${formattedPhone}`);
      const data = await response.json();
      
      return {
        success: true,
        imageUrl: data.link || null
      };
    } catch (error) {
      console.error('[Z-API] Erro ao obter foto:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Formata número de telefone
   */
  formatPhone(phone) {
    // Remove tudo que não é número
    let cleaned = phone.toString().replace(/\D/g, '');
    
    // Se não começar com 55, adiciona
    if (!cleaned.startsWith('55')) {
      cleaned = '55' + cleaned;
    }
    
    return cleaned;
  }
}

module.exports = ZAPIAdapter;
