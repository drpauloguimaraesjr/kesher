/**
 * 🕎 Kesher API - קֶשֶׁר
 * Sua conexão WhatsApp poderosa e confiável
 *
 * "Kesher" significa "Conexão" em hebraico
 * API multi-instância baseada em Baileys
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

// Configurações
const { initializeFirebase } = require("./config/firebase");

// Middlewares
const authMiddleware = require("./middleware/auth");
const { rateLimiter } = require("./middleware/rateLimiter");

// Rotas
const instanceRoutes = require("./routes/instance");
const messageRoutes = require("./routes/message");
const webhookRoutes = require("./routes/webhook");
const zapiRoutes = require("./routes/zapi");

// Managers
const manager = require("./services/WhatsAppManager");
const zapiManager = require("./services/ZAPIManager");

const app = express();
const PORT = process.env.PORT || 3001;

// ========== MIDDLEWARES GLOBAIS ==========

// Segurança
app.use(helmet());

// CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-API-Key", "Authorization"],
  })
);

// Parse JSON
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting global
app.use(rateLimiter);

// Log de requisições
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ========== ROTAS PÚBLICAS ==========

// Health check (não precisa de autenticação)
app.get("/health", (req, res) => {
  const stats = manager.getStats();
  res.json({
    status: "ok",
    service: "Kesher API",
    hebrew: "קֶשֶׁר",
    meaning: "Conexão",
    version: "1.0.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    instances: stats,
  });
});

// ========== WEBHOOKS PÚBLICOS (Z-API / WHAPI não enviam API Key) ==========

// Importar handlers de webhook diretamente
const zapiWebhookRouter = require('./routes/zapi');
const whapiWebhookRouter = require('./routes/whapi');

// POST /api/zapi/webhook - recebe eventos do Z-API
app.post("/api/zapi/webhook", (req, res, next) => {
  // Redirecionar para o router de zapi
  req.url = '/webhook';
  zapiWebhookRouter(req, res, next);
});

// POST /api/zapi/webhook/test - testar webhook
app.post("/api/zapi/webhook/test", (req, res, next) => {
  req.url = '/webhook/test';
  zapiWebhookRouter(req, res, next);
});

// GET /api/zapi/webhook - health check do webhook
app.get("/api/zapi/webhook", (req, res, next) => {
  req.url = '/webhook';
  zapiWebhookRouter(req, res, next);
});

// POST /api/whapi/webhook - recebe eventos do WHAPI (messages.post / statuses.post)
app.post("/api/whapi/webhook", (req, res, next) => {
  req.url = '/webhook';
  whapiWebhookRouter(req, res, next);
});

// POST /api/whapi/webhook/test - testar webhook WHAPI
app.post("/api/whapi/webhook/test", (req, res, next) => {
  req.url = '/webhook/test';
  whapiWebhookRouter(req, res, next);
});

// GET /api/whapi/webhook - health check do webhook WHAPI
app.get("/api/whapi/webhook", (req, res, next) => {
  req.url = '/webhook';
  whapiWebhookRouter(req, res, next);
});

// GET /api/whapi/status - status do canal WHAPI
app.get("/api/whapi/status", (req, res, next) => {
  req.url = '/status';
  whapiWebhookRouter(req, res, next);
});

// ========== ROTAS PROTEGIDAS ==========

// Autenticação via API Key
app.use("/api", authMiddleware);

// Rotas de instâncias
app.use("/api/instance", instanceRoutes);
app.use("/api/instances", instanceRoutes);

// Rotas de mensagens
app.use("/api/message", messageRoutes);

// Rotas de webhooks
app.use("/api/webhook", webhookRoutes);

// Rotas Z-API (nova integração estável)
app.use("/api/zapi", zapiRoutes);

// ========== ERROR HANDLING ==========

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint não encontrado",
    hint: "Consulte a documentação em /health",
  });
});

// Erro genérico
app.use((err, req, res, next) => {
  console.error("❌ Erro não tratado:", err);
  res.status(500).json({
    success: false,
    error: "Erro interno do servidor",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// ========== INICIALIZAÇÃO ==========

async function startServer() {
  try {
    console.log("");
    console.log("╔════════════════════════════════════════════╗");
    console.log("║    🕎 Kesher API - קֶשֶׁר                    ║");
    console.log("║    Sua conexão WhatsApp poderosa!          ║");
    console.log("╚════════════════════════════════════════════╝");
    console.log("");

    // 1. Inicializa Firebase
    console.log("🔥 Inicializando Firebase...");
    initializeFirebase();

    // 2. Carrega instâncias existentes (Baileys - legacy)
    console.log("📂 Carregando instâncias Baileys...");
    await manager.loadExistingInstances();

    // 3. Carrega instâncias Z-API
    console.log("📂 Carregando instâncias Z-API...");
    await zapiManager.loadExistingInstances();

    // 4. Status do provider WHAPI (piloto)
    const pilotPhones = (process.env.WHAPI_PILOT_PHONES || '')
      .split(',').map(p => p.trim()).filter(Boolean);
    const whapiConfigured = !!process.env.WHAPI_TOKEN;
    console.log(`🔀 Provider router: ${pilotPhones.length} número(s) piloto em WHAPI, restante em Z-API`);
    console.log(`   WHAPI token:   ${whapiConfigured ? '✅ configurado' : '⚠️  ausente'}`);
    console.log(`   Pilot phones:  ${pilotPhones.length ? pilotPhones.join(', ') : '(vazio — tudo vai por Z-API)'}`);

    // 5. Inicia servidor
    app.listen(PORT, () => {
      console.log("");
      console.log(`✅ Servidor rodando na porta ${PORT}`);
      console.log("");
      console.log("📡 Endpoints disponíveis:");
      console.log(`   GET  http://localhost:${PORT}/health`);
      console.log(`   POST http://localhost:${PORT}/api/zapi/webhook       (Z-API)`);
      console.log(`   POST http://localhost:${PORT}/api/whapi/webhook      (WHAPI)`);
      console.log(`   POST http://localhost:${PORT}/api/zapi/message/send/text    (roteado por número)`);
      console.log(`   POST http://localhost:${PORT}/api/zapi/chat/send-presence   (typing indicator)`);
      console.log("");
      console.log("📖 Documentação completa no README.md");
      console.log("");
    });
  } catch (error) {
    console.error("❌ Falha ao iniciar servidor:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Encerrando servidor...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n👋 Encerrando servidor...");
  process.exit(0);
});

// Inicia!
startServer();
