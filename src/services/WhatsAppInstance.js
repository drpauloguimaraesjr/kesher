/**
 * 📱 WhatsApp Instance
 * Gerencia uma única conexão WhatsApp
 * 
 * Baseado na engenharia do NutriBuddy, mas isolado e reutilizável
 */

const { getDb } = require('../config/firebase');
const pino = require('pino');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

// Baileys (carregado dinamicamente)
let makeWASocket, DisconnectReason, makeCacheableSignalKeyStore, fetchLatestBaileysVersion;
let baileysLoaded = false;

class WhatsAppInstance {
  constructor(instanceId, options = {}) {
    this.instanceId = instanceId;
    this.sessionId = `whatsapp-session-${instanceId}`;
    
    // Estado
    this.sock = null;
    this.qrCode = null;
    this.qrCodeBase64 = null;
    this.connected = false;
    this.connectionState = 'disconnected';
    this.userInfo = null;
    
    // Proteções anti-loop
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = parseInt(process.env.MAX_RECONNECT_ATTEMPTS) || 3;
    this.reconnectInterval = parseInt(process.env.RECONNECT_INTERVAL_MS) || 30000;
    this.lastConnectAttempt = 0;
    
    // Callbacks
    this.onMessageCallback = options.onMessage || null;
    this.onStatusChangeCallback = options.onStatusChange || null;
    
    // Webhooks registrados
    this.webhooks = [];
    
    console.log(`📱 [Instance:${instanceId}] Criada`);
  }

  /**
   * Carrega Baileys dinamicamente
   */
  async loadBaileys() {
    if (baileysLoaded) return;

    try {
      const baileys = await import('@whiskeysockets/baileys');
      makeWASocket = baileys.default;
      DisconnectReason = baileys.DisconnectReason;
      makeCacheableSignalKeyStore = baileys.makeCacheableSignalKeyStore;
      fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;
      baileysLoaded = true;
      console.log(`✅ [Instance:${this.instanceId}] Baileys carregado`);
    } catch (error) {
      console.error(`❌ [Instance:${this.instanceId}] Erro ao carregar Baileys:`, error);
      throw error;
    }
  }

  /**
   * Adaptador de autenticação Firestore
   */
  async useFirestoreAuthState() {
    const db = getDb();
    const collection = process.env.SESSION_COLLECTION || 'whatsapp-sessions';
    const docRef = db.collection(collection).doc(this.sessionId);

    const readData = async (key) => {
      try {
        const doc = await docRef.collection('keys').doc(key).get();
        return doc.exists ? JSON.parse(doc.data().value) : null;
      } catch {
        return null;
      }
    };

    const writeData = async (key, data) => {
      try {
        await docRef.collection('keys').doc(key).set({
          value: JSON.stringify(data),
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        console.error(`❌ [Instance:${this.instanceId}] Erro ao salvar:`, error);
      }
    };

    const creds = await readData('creds') || {};
    
    return {
      state: {
        creds,
        keys: {
          get: async (type, ids) => {
            const result = {};
            for (const id of ids) {
              const data = await readData(`${type}-${id}`);
              if (data) result[id] = data;
            }
            return result;
          },
          set: async (data) => {
            for (const [type, entries] of Object.entries(data)) {
              for (const [id, value] of Object.entries(entries)) {
                if (value) {
                  await writeData(`${type}-${id}`, value);
                }
              }
            }
          }
        }
      },
      saveCreds: async () => {
        await writeData('creds', creds);
      }
    };
  }

  /**
   * Conecta ao WhatsApp
   */
  async connect() {
    // Proteção contra conexões simultâneas
    if (this.isConnecting) {
      console.log(`⚠️ [Instance:${this.instanceId}] Já conectando...`);
      return { success: false, error: 'Conexão em andamento' };
    }

    // Rate limiting
    const now = Date.now();
    if (now - this.lastConnectAttempt < this.reconnectInterval && this.lastConnectAttempt > 0) {
      const wait = Math.ceil((this.reconnectInterval - (now - this.lastConnectAttempt)) / 1000);
      console.log(`⏳ [Instance:${this.instanceId}] Aguarde ${wait}s`);
      return { success: false, error: `Aguarde ${wait}s` };
    }

    this.isConnecting = true;
    this.lastConnectAttempt = now;

    try {
      await this.loadBaileys();

      // Carregar sessão do Firestore
      const { state, saveCreds } = await this.useFirestoreAuthState();
      const { version } = await fetchLatestBaileysVersion();

      // Criar socket
      this.sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        logger: pino({ level: 'silent' }),
        browser: ['WhatsApp API', 'Chrome', '120.0.0'],
        generateHighQualityLinkPreview: true,
      });

      // Evento: Atualização de conexão
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // QR Code gerado
        if (qr) {
          this.qrCode = qr;
          this.qrCodeBase64 = await QRCode.toDataURL(qr);
          this.connectionState = 'qr_ready';
          console.log(`📱 [Instance:${this.instanceId}] QR Code pronto!`);
          this.notifyStatusChange('qr_ready', { qr: this.qrCodeBase64 });
        }

        // Conexão fechada
        if (connection === 'close') {
          const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
          
          console.log(`❌ [Instance:${this.instanceId}] Desconectado. Reconectar: ${shouldReconnect}`);
          
          this.connected = false;
          this.connectionState = 'disconnected';
          this.isConnecting = false;
          
          if (shouldReconnect) {
            this.scheduleReconnect();
          } else {
            this.notifyStatusChange('logged_out');
          }
        }

        // Conectado com sucesso
        if (connection === 'open') {
          console.log(`✅ [Instance:${this.instanceId}] Conectado!`);
          
          this.connected = true;
          this.connectionState = 'connected';
          this.qrCode = null;
          this.reconnectAttempts = 0;
          this.isConnecting = false;
          
          const user = this.sock?.user;
          this.userInfo = {
            id: user?.id,
            name: user?.name || 'WhatsApp API',
            phone: user?.id?.replace('@s.whatsapp.net', ''),
          };
          
          this.notifyStatusChange('connected', { user: this.userInfo });
        }
      });

      // Evento: Salvar credenciais
      this.sock.ev.on('creds.update', saveCreds);

      // Evento: Mensagens recebidas
      this.sock.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];
        if (!message?.message || message.key.fromMe) return;
        
        const remoteJid = message.key.remoteJid || '';
        if (remoteJid.includes('status@broadcast') || remoteJid.includes('@g.us')) return;

        await this.handleIncomingMessage(message);
      });

      console.log(`🎯 [Instance:${this.instanceId}] Aguardando eventos...`);
      return { success: true };

    } catch (error) {
      console.error(`❌ [Instance:${this.instanceId}] Erro:`, error);
      this.isConnecting = false;
      return { success: false, error: error.message };
    }
  }

  /**
   * Agenda reconexão com backoff
   */
  scheduleReconnect() {
    this.reconnectAttempts++;
    
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.error(`❌ [Instance:${this.instanceId}] Max tentativas. Aguardando 10 min...`);
      setTimeout(() => {
        this.reconnectAttempts = 0;
        this.lastConnectAttempt = 0;
        this.connect();
      }, 10 * 60 * 1000);
      return;
    }

    const delay = Math.min(this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1), 120000);
    console.log(`🔄 [Instance:${this.instanceId}] Reconectando em ${delay/1000}s (tentativa ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => this.connect(), delay);
  }

  /**
   * Processa mensagem recebida
   */
  async handleIncomingMessage(rawMessage) {
    const message = {
      instanceId: this.instanceId,
      messageId: rawMessage.key.id,
      from: rawMessage.key.remoteJid?.replace('@s.whatsapp.net', ''),
      fromName: rawMessage.pushName || 'Desconhecido',
      timestamp: new Date(rawMessage.messageTimestamp * 1000).toISOString(),
      type: this.getMessageType(rawMessage.message),
      content: this.extractContent(rawMessage.message),
      raw: rawMessage,
    };

    console.log(`📩 [Instance:${this.instanceId}] Msg de ${message.from}: ${message.type}`);

    // Callback local
    if (this.onMessageCallback) {
      await this.onMessageCallback(message);
    }

    // Webhooks
    await this.triggerWebhooks('message', message);
  }

  getMessageType(msg) {
    if (msg?.conversation || msg?.extendedTextMessage) return 'text';
    if (msg?.imageMessage) return 'image';
    if (msg?.videoMessage) return 'video';
    if (msg?.audioMessage) return 'audio';
    if (msg?.documentMessage) return 'document';
    if (msg?.stickerMessage) return 'sticker';
    return 'unknown';
  }

  extractContent(msg) {
    if (msg?.conversation) return msg.conversation;
    if (msg?.extendedTextMessage?.text) return msg.extendedTextMessage.text;
    if (msg?.imageMessage?.caption) return msg.imageMessage.caption;
    if (msg?.videoMessage?.caption) return msg.videoMessage.caption;
    return null;
  }

  /**
   * Envia mensagem de texto
   */
  async sendTextMessage(phone, text) {
    if (!this.connected || !this.sock) {
      throw new Error('WhatsApp não conectado');
    }

    const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
    
    const result = await this.sock.sendMessage(jid, { text });
    console.log(`📤 [Instance:${this.instanceId}] Texto enviado para ${phone}`);
    
    return {
      success: true,
      messageId: result.key.id,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Envia imagem
   */
  async sendImageMessage(phone, imageUrl, caption = '') {
    if (!this.connected || !this.sock) {
      throw new Error('WhatsApp não conectado');
    }

    const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
    
    const result = await this.sock.sendMessage(jid, {
      image: { url: imageUrl },
      caption
    });
    
    console.log(`📤 [Instance:${this.instanceId}] Imagem enviada para ${phone}`);
    return { success: true, messageId: result.key.id };
  }

  /**
   * Notifica mudança de status
   */
  notifyStatusChange(status, data = {}) {
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(status, data);
    }
    this.triggerWebhooks('status', { status, ...data });
  }

  /**
   * Registra webhook
   */
  registerWebhook(url, events = ['message', 'status']) {
    const webhook = {
      id: uuidv4(),
      url,
      events,
      createdAt: new Date().toISOString()
    };
    this.webhooks.push(webhook);
    console.log(`🔗 [Instance:${this.instanceId}] Webhook registrado: ${url}`);
    return webhook;
  }

  /**
   * Dispara webhooks
   */
  async triggerWebhooks(event, data) {
    const relevantWebhooks = this.webhooks.filter(w => w.events.includes(event));
    
    for (const webhook of relevantWebhooks) {
      try {
        await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Event': event,
            'X-Instance-Id': this.instanceId
          },
          body: JSON.stringify({
            event,
            instanceId: this.instanceId,
            timestamp: new Date().toISOString(),
            data
          })
        });
      } catch (error) {
        console.error(`❌ [Instance:${this.instanceId}] Webhook falhou: ${webhook.url}`);
      }
    }
  }

  /**
   * Retorna status atual
   */
  getStatus() {
    return {
      instanceId: this.instanceId,
      connected: this.connected,
      state: this.connectionState,
      user: this.userInfo,
      reconnectAttempts: this.reconnectAttempts,
      webhooksCount: this.webhooks.length
    };
  }

  /**
   * Retorna QR Code
   */
  getQRCode() {
    return {
      available: !!this.qrCode,
      qr: this.qrCode,
      qrBase64: this.qrCodeBase64
    };
  }

  /**
   * Desconecta
   */
  async disconnect() {
    try {
      if (this.sock) {
        await this.sock.logout();
        this.sock = null;
      }
      this.connected = false;
      this.connectionState = 'disconnected';
      console.log(`👋 [Instance:${this.instanceId}] Desconectado`);
    } catch (error) {
      console.error(`❌ [Instance:${this.instanceId}] Erro ao desconectar:`, error);
    }
  }

  /**
   * Limpa sessão (force reset)
   */
  async clearSession() {
    const db = getDb();
    const collection = process.env.SESSION_COLLECTION || 'whatsapp-sessions';
    
    try {
      const keysRef = db.collection(collection).doc(this.sessionId).collection('keys');
      const snapshot = await keysRef.get();
      
      const batch = db.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      
      console.log(`🗑️ [Instance:${this.instanceId}] Sessão limpa`);
      return { success: true, deletedKeys: snapshot.size };
    } catch (error) {
      console.error(`❌ [Instance:${this.instanceId}] Erro ao limpar sessão:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = WhatsAppInstance;
