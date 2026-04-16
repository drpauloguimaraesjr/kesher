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

const whapiJidMap = require('./WhapiJidMap');

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
   *
   * Regras Brasil (DDI 55):
   *   - Adiciona DDI 55 se vier sem ele e tiver 10-11 dígitos.
   *
   * Override do nono dígito (caso patológico):
   *   - WHAPI_FORCE_NO9_FOR aceita lista de números (CSV) cujo "9" entre
   *     DDD e número deve ser REMOVIDO antes de enviar. Use quando o
   *     WhatsApp do paciente está registrado no JID antigo (sem 9) e as
   *     mensagens OUT ficam presas em status=sent (nunca delivered)
   *     porque o JID com 9 não corresponde a nenhum dispositivo.
   *
   *   Exemplo: WHAPI_FORCE_NO9_FOR=5547992567770
   *     entrada 5547992567770 → saída 554792567770 (JID antigo)
   */
  formatPhone(phone) {
    if (!phone) return '';
    if (String(phone).includes('@')) return String(phone);

    let cleaned = String(phone).replace(/\D/g, '');
    if (!cleaned.startsWith('55') && cleaned.length >= 10 && cleaned.length <= 11) {
      cleaned = '55' + cleaned;
    }

    // Override: remover o 9 para números configurados em WHAPI_FORCE_NO9_FOR
    const forceNo9 = (process.env.WHAPI_FORCE_NO9_FOR || '')
      .split(',')
      .map((n) => n.trim().replace(/\D/g, ''))
      .filter(Boolean);

    if (cleaned.length === 13 && cleaned.startsWith('55') && forceNo9.includes(cleaned)) {
      const ddd = cleaned.substring(2, 4);
      const numComNove = cleaned.substring(4); // 9XXXXYYYY (9 dígitos)
      if (numComNove.startsWith('9')) {
        cleaned = `55${ddd}${numComNove.substring(1)}`; // remove o 9 inicial
        console.log(`[WHAPI formatPhone] override sem-9 aplicado → ${cleaned}`);
      }
    }

    return cleaned;
  }

  /**
   * Resolve o destino do envio:
   *   1. Tenta lookup no WhapiJidMap (chat_id real visto em mensagem
   *      anterior do paciente). Se houver, retorna o chat_id literal.
   *   2. Fallback: usa formatPhone (com WHAPI_FORCE_NO9_FOR opcional).
   *
   * Garante que respostas caiam SEMPRE no JID que o paciente realmente
   * usa, eliminando o problema de respostas presas em status=sent.
   */
  async resolveTo(phone) {
    try {
      const mapped = await whapiJidMap.lookup(phone);
      if (mapped) {
        console.log(`[WHAPI resolveTo] mapping hit: ${phone} → ${mapped}`);
        return mapped;
      }
    } catch (err) {
      console.error('[WHAPI resolveTo] erro no lookup, usando formatPhone:', err.message);
    }
    const formatted = this.formatPhone(phone);
    console.log(`[WHAPI resolveTo] sem mapping, formatPhone: ${phone} → ${formatted}`);
    return formatted;
  }

  async request(method, path, body = null) {
    if (!this.isConfigured()) {
      console.error(`[WHAPI HTTP] ❌ ${method} ${path} — WHAPI_TOKEN não configurado`);
      return { success: false, error: 'WHAPI_TOKEN não configurado' };
    }
    const bodyStr = body ? JSON.stringify(body) : '';
    console.log(`[WHAPI HTTP] ➡️  ${method} ${this.baseUrl}${path} body=${bodyStr.slice(0, 300)}`);
    try {
      const init = {
        method,
        headers: this.getHeaders(),
      };
      if (body !== null && body !== undefined) {
        init.body = bodyStr;
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
        console.error(
          `[WHAPI HTTP] ❌ ${method} ${path} → HTTP ${response.status}:`,
          JSON.stringify(data).slice(0, 400)
        );
        return {
          success: false,
          status: response.status,
          error: data.message || data.error || `HTTP ${response.status}`,
          data,
        };
      }
      const idHint =
        data?.message?.id ||
        data?.sent?.id ||
        data?.id ||
        (Array.isArray(data.messages) && data.messages[0]?.id) ||
        '';
      console.log(
        `[WHAPI HTTP] ✅ ${method} ${path} → ${response.status} ${idHint ? `id=${idHint}` : ''}`
      );
      return { success: true, status: response.status, data };
    } catch (error) {
      console.error(`[WHAPI HTTP] 💥 ${method} ${path} erro de rede:`, error.message);
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
    const to = await this.resolveTo(phone);
    const result = await this.request('POST', '/messages/text', {
      to,
      body: message,
    });
    if (!result.success) return result;
    return { success: true, messageId: this.extractMessageId(result), data: result.data };
  }

  async sendImageMessage(phone, imageUrl, caption = '') {
    const to = await this.resolveTo(phone);
    const result = await this.request('POST', '/messages/image', {
      to,
      media: imageUrl, // WHAPI aceita URL (string) ou { url, mime_type } (objeto)
      caption,
    });
    if (!result.success) return result;
    return { success: true, messageId: this.extractMessageId(result), data: result.data };
  }

  async sendVideoMessage(phone, videoUrl, caption = '') {
    const to = await this.resolveTo(phone);
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
    const to = await this.resolveTo(phone);
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
    const to = await this.resolveTo(phone);
    const result = await this.request('POST', '/messages/voice', {
      to,
      media: voiceUrl,
    });
    if (!result.success) return result;
    return { success: true, messageId: this.extractMessageId(result), data: result.data };
  }

  async sendDocumentMessage(phone, documentUrl, filename = 'document', caption = '') {
    const to = await this.resolveTo(phone);
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
    const to = await this.resolveTo(phone);
    const result = await this.request('POST', '/messages/sticker', {
      to,
      media: stickerUrl,
    });
    if (!result.success) return result;
    return { success: true, messageId: this.extractMessageId(result), data: result.data };
  }

  async sendLocationMessage(phone, latitude, longitude, name = '', address = '') {
    const to = await this.resolveTo(phone);
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
    const entryId = await this.resolveTo(phone);
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
