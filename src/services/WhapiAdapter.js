/**
 * 🔌 WHAPI Adapter — cliente HTTP para a API do WHAPI (gate.whapi.cloud)
 *
 * Singleton global. Usa Bearer token em Authorization para autenticar.
 * Funciona apenas para números listados em WHAPI_PILOT_PHONES (via providerRouter).
 *
 * Endpoints implementados:
 *   - POST /messages/text              → envio de texto
 *   - POST /messages/image             → envio de imagem
 *   - POST /messages/video             → envio de vídeo
 *   - POST /messages/audio             → envio de áudio (arquivo)
 *   - POST /messages/voice             → envio de áudio de voz (PTT)
 *   - POST /messages/document          → envio de documento
 *   - POST /messages/sticker           → envio de sticker
 *   - POST /messages/location          → envio de localização
 *   - PUT  /presences/{EntryID}        → typing / recording / pause
 *   - GET  /health                     → status do canal
 *   - GET  /settings                   → configuração do canal (webhooks, etc.)
 *   - GET  /contacts/{ID}/profile      → dados do contato
 *
 * Docs: https://whapi.readme.io/reference/
 */

class WhapiAdapter {
  get baseUrl() {
    return (process.env.WHAPI_API_URL || 'https://gate.whapi.cloud').replace(/\/$/, '');
  }

  get token() {
    return process.env.WHAPI_TOKEN || '';
  }

  isConfigured() {
    return Boolean(this.token);
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/json',
    };
  }

  /**
   * Normaliza número para o formato esperado pelo WHAPI.
   * WHAPI aceita número puro (DDI+DDD+número) ou chat_id completo.
   * Adiciona prefixo 55 (Brasil) se o número vier sem DDI e for curto.
   */
  formatPhone(phone) {
    if (!phone) return '';
    // Se já vier com @, usar como está (chat_id completo)
    if (String(phone).includes('@')) return String(phone);

    let cleaned = String(phone).replace(/\D/g, '');
    // Se o número não começa com 55 e tem 10-11 dígitos → é local BR
    if (!cleaned.startsWith('55') && cleaned.length >= 10 && cleaned.length <= 11) {
      cleaned = '55' + cleaned;
    }
    return cleaned;
  }

  async request(method, path, body = null) {
    if (!this.isConfigured()) {
      return { success: false, error: 'WHAPI_TOKEN não configurado' };
    }
    try {
      const init = {
        method,
        headers: this.getHeaders(),
      };
      if (body !== null && body !== undefined) {
        init.body = JSON.stringify(body);
      }
      const response = await fetch(`${this.baseUrl}${path}`, init);
      let data = {};
      const text = await response.text();
      try {
        data = text ? JSON.parse(text) : {};
      } catch (_) {
        data = { raw: text };
      }
      if (!response.ok) {
        console.error(`[WHAPI] ${method} ${path} falhou com HTTP ${response.status}:`, data);
        return {
          success: false,
          status: response.status,
          error: data.message || data.error || `HTTP ${response.status}`,
          data,
        };
      }
      return { success: true, status: response.status, data };
    } catch (error) {
      console.error(`[WHAPI] ${method} ${path} erro:`, error.message);
      return { success: false, error: error.message };
    }
  }

  extractMessageId(result) {
    const d = result.data || {};
    return (
      d?.message?.id ||
      d?.sent?.id ||
      d?.id ||
      (Array.isArray(d.messages) && d.messages[0]?.id) ||
      null
    );
  }

  // ========================================================
  // SENDERS
  // ========================================================

  async sendTextMessage(phone, message) {
    const to = this.formatPhone(phone);
    const result = await this.request('POST', '/messages/text', {
      to,
      body: message,
    });
    if (!result.success) return result;
    return { success: true, messageId: this.extractMessageId(result), data: result.data };
  }

  async sendImageMessage(phone, imageUrl, caption = '') {
    const to = this.formatPhone(phone);
    const result = await this.request('POST', '/messages/image', {
      to,
      media: imageUrl, // WHAPI aceita URL (string) ou { url, mime_type } (objeto)
      caption,
    });
    if (!result.success) return result;
    return { success: true, messageId: this.extractMessageId(result), data: result.data };
  }

  async sendVideoMessage(phone, videoUrl, caption = '') {
    const to = this.formatPhone(phone);
    const result = await this.request('POST', '/messages/video', {
      to,
      media: videoUrl,
      caption,
    });
    if (!result.success) return result;
    return { success: true, messageId: this.extractMessageId(result), data: result.data };
  }

  /**
   * Envia áudio como arquivo regular (player aparece como áudio comum).
   */
  async sendAudioMessage(phone, audioUrl) {
    const to = this.formatPhone(phone);
    const result = await this.request('POST', '/messages/audio', {
      to,
      media: audioUrl,
    });
    if (!result.success) return result;
    return { success: true, messageId: this.extractMessageId(result), data: result.data };
  }

  /**
   * Envia áudio como mensagem de voz (PTT / push-to-talk, bolinha de voz do WhatsApp).
   */
  async sendVoiceMessage(phone, voiceUrl) {
    const to = this.formatPhone(phone);
    const result = await this.request('POST', '/messages/voice', {
      to,
      media: voiceUrl,
    });
    if (!result.success) return result;
    return { success: true, messageId: this.extractMessageId(result), data: result.data };
  }

  async sendDocumentMessage(phone, documentUrl, filename = 'document', caption = '') {
    const to = this.formatPhone(phone);
    const payload = {
      to,
      media: documentUrl,
      filename,
    };
    if (caption) payload.caption = caption;
    const result = await this.request('POST', '/messages/document', payload);
    if (!result.success) return result;
    return { success: true, messageId: this.extractMessageId(result), data: result.data };
  }

  async sendStickerMessage(phone, stickerUrl) {
    const to = this.formatPhone(phone);
    const result = await this.request('POST', '/messages/sticker', {
      to,
      media: stickerUrl,
    });
    if (!result.success) return result;
    return { success: true, messageId: this.extractMessageId(result), data: result.data };
  }

  async sendLocationMessage(phone, latitude, longitude, name = '', address = '') {
    const to = this.formatPhone(phone);
    const result = await this.request('POST', '/messages/location', {
      to,
      latitude,
      longitude,
      name,
      address,
    });
    if (!result.success) return result;
    return { success: true, messageId: this.extractMessageId(result), data: result.data };
  }

  // ========================================================
  // PRESENÇA (typing/recording/pause)
  // ========================================================

  /**
   * Envia indicador de presença para um chat.
   * @param {string} phone   — número do destinatário
   * @param {string} presence — 'typing' | 'recording' | 'pause'
   * @param {number} delay   — segundos que o typing deve ficar visível (0 = default do WHAPI)
   */
  async sendPresence(phone, presence = 'typing', delay = 0) {
    const entryId = this.formatPhone(phone);
    const valid = ['typing', 'recording', 'pause'];
    const normalized = valid.includes(presence) ? presence : 'typing';
    const result = await this.request('PUT', `/presences/${encodeURIComponent(entryId)}`, {
      presence: normalized,
      delay: Number(delay) || 0,
    });
    return result;
  }

  // ========================================================
  // DIAGNÓSTICO / STATUS
  // ========================================================

  async getStatus() {
    const result = await this.request('GET', '/health');
    if (!result.success) return result;
    const d = result.data || {};
    return {
      success: true,
      connected: d.status === 'AUTH' || d.connected === true || d.status === 'READY',
      status: d.status,
      data: d,
    };
  }

  async getSettings() {
    return this.request('GET', '/settings');
  }

  async getContactProfile(phone) {
    const entryId = this.formatPhone(phone);
    return this.request('GET', `/contacts/${encodeURIComponent(entryId)}/profile`);
  }
}

module.exports = new WhapiAdapter();
