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

  /**
   * Helper: mescla opções comuns (quoted, mentions, typing_time) no payload.
   * O caller passa { to, body, ... } e opts: { quoted?, mentions?, typingTime? }.
   */
  applyOpts(payload, opts = {}) {
    if (opts.quoted) payload.quoted = opts.quoted;
    if (opts.mentions?.length) payload.mentions = opts.mentions;
    if (opts.typingTime != null) payload.typing_time = Number(opts.typingTime);
    if (opts.viewOnce) payload.view_once = true;
    if (opts.noLinkPreview) payload.no_link_preview = true;
    return payload;
  }

  async sendTextMessage(phone, message, opts = {}) {
    const to = await this.resolveTo(phone);
    const payload = this.applyOpts({ to, body: message }, opts);
    const result = await this.request('POST', '/messages/text', payload);
    if (!result.success) return result;
    return { success: true, messageId: this.extractMessageId(result), data: result.data };
  }

  async sendImageMessage(phone, imageUrl, caption = '', opts = {}) {
    const to = await this.resolveTo(phone);
    const payload = this.applyOpts({ to, media: imageUrl, caption }, opts);
    const result = await this.request('POST', '/messages/image', payload);
    if (!result.success) return result;
    return { success: true, messageId: this.extractMessageId(result), data: result.data };
  }

  async sendVideoMessage(phone, videoUrl, caption = '', opts = {}) {
    const to = await this.resolveTo(phone);
    const payload = this.applyOpts({ to, media: videoUrl, caption }, opts);
    const result = await this.request('POST', '/messages/video', payload);
    if (!result.success) return result;
    return { success: true, messageId: this.extractMessageId(result), data: result.data };
  }

  async sendAudioMessage(phone, audioUrl, opts = {}) {
    const to = await this.resolveTo(phone);
    const payload = this.applyOpts({ to, media: audioUrl }, opts);
    const result = await this.request('POST', '/messages/audio', payload);
    if (!result.success) return result;
    return { success: true, messageId: this.extractMessageId(result), data: result.data };
  }

  async sendVoiceMessage(phone, voiceUrl, opts = {}) {
    const to = await this.resolveTo(phone);
    const payload = this.applyOpts({ to, media: voiceUrl }, opts);
    const result = await this.request('POST', '/messages/voice', payload);
    if (!result.success) return result;
    return { success: true, messageId: this.extractMessageId(result), data: result.data };
  }

  async sendDocumentMessage(phone, documentUrl, filename = 'document', caption = '', opts = {}) {
    const to = await this.resolveTo(phone);
    const payload = this.applyOpts({ to, media: documentUrl, filename }, opts);
    if (caption) payload.caption = caption;
    const result = await this.request('POST', '/messages/document', payload);
    if (!result.success) return result;
    return { success: true, messageId: this.extractMessageId(result), data: result.data };
  }

  async sendStickerMessage(phone, stickerUrl, opts = {}) {
    const to = await this.resolveTo(phone);
    const payload = this.applyOpts({ to, media: stickerUrl }, opts);
    const result = await this.request('POST', '/messages/sticker', payload);
    if (!result.success) return result;
    return { success: true, messageId: this.extractMessageId(result), data: result.data };
  }

  async sendLocationMessage(phone, latitude, longitude, name = '', address = '', opts = {}) {
    const to = await this.resolveTo(phone);
    const payload = this.applyOpts({ to, latitude, longitude, name, address }, opts);
    const result = await this.request('POST', '/messages/location', payload);
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
  // REAÇÕES
  // ========================================================

  async sendReaction(phone, messageId, emoji) {
    const to = await this.resolveTo(phone);
    const result = await this.request('POST', '/messages/reaction', {
      to,
      message_id: messageId,
      emoji: emoji || '',
    });
    return result;
  }

  // ========================================================
  // ENQUETES (POLLS)
  // ========================================================

  async sendPoll(phone, title, options, multipleAnswers = false) {
    const to = await this.resolveTo(phone);
    const result = await this.request('POST', '/messages/poll', {
      to,
      title,
      options: options.map((o) => (typeof o === 'string' ? { name: o } : o)),
      multiple_answers: multipleAnswers,
    });
    if (!result.success) return result;
    return { success: true, messageId: this.extractMessageId(result), data: result.data };
  }

  // ========================================================
  // MENSAGENS INTERATIVAS (botões, listas)
  // ========================================================

  async sendButtons(phone, body, buttons, header = '', footer = '') {
    const to = await this.resolveTo(phone);
    const payload = {
      to,
      body,
      action: {
        buttons: buttons.map((b, i) => ({
          type: 'reply',
          reply: {
            id: b.id || `btn_${i}`,
            title: typeof b === 'string' ? b : b.title,
          },
        })),
      },
    };
    if (header) payload.header = { type: 'text', text: header };
    if (footer) payload.footer = footer;
    const result = await this.request('POST', '/messages/interactive', payload);
    if (!result.success) return result;
    return { success: true, messageId: this.extractMessageId(result), data: result.data };
  }

  async sendList(phone, body, sections, buttonText = 'Menu', header = '', footer = '') {
    const to = await this.resolveTo(phone);
    const payload = {
      to,
      body,
      action: {
        button: buttonText,
        sections: sections.map((s) => ({
          title: s.title || '',
          rows: (s.rows || s.options || []).map((r, i) => ({
            id: r.id || `row_${i}`,
            title: typeof r === 'string' ? r : r.title,
            description: r.description || '',
          })),
        })),
      },
    };
    if (header) payload.header = { type: 'text', text: header };
    if (footer) payload.footer = footer;
    const result = await this.request('POST', '/messages/interactive', payload);
    if (!result.success) return result;
    return { success: true, messageId: this.extractMessageId(result), data: result.data };
  }

  // ========================================================
  // EDIÇÃO / DELEÇÃO DE MENSAGENS
  // ========================================================

  async editMessage(phone, messageId, newText) {
    const to = await this.resolveTo(phone);
    const result = await this.request('POST', '/messages/text', {
      to,
      body: newText,
      edit: messageId,
    });
    if (!result.success) return result;
    return { success: true, messageId: this.extractMessageId(result), data: result.data };
  }

  async deleteMessage(messageId) {
    const result = await this.request('DELETE', `/messages/${encodeURIComponent(messageId)}`);
    return result;
  }

  // ========================================================
  // READ RECEIPTS
  // ========================================================

  async markAsRead(phone, messageId) {
    const chatId = await this.resolveTo(phone);
    const result = await this.request('PUT', `/chats/${encodeURIComponent(chatId)}`, {
      last_read_message: messageId,
    });
    return result;
  }

  // ========================================================
  // CONTATOS (vCard)
  // ========================================================

  async sendContact(phone, contactName, contactPhone) {
    const to = await this.resolveTo(phone);
    const cleanPhone = String(contactPhone).replace(/\D/g, '');
    const result = await this.request('POST', '/messages/contact', {
      to,
      name: contactName,
      vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${contactName}\nTEL;type=CELL:+${cleanPhone}\nEND:VCARD`,
    });
    if (!result.success) return result;
    return { success: true, messageId: this.extractMessageId(result), data: result.data };
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
