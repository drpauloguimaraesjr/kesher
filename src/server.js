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

    // 3. Inicia servidor
    app.listen(PORT, () => {
      console.log("");
      console.log(`✅ Servidor rodando na porta ${PORT}`);
      console.log("");
      console.log("📡 Endpoints disponíveis:");
      console.log(`   GET  http://localhost:${PORT}/health`);
      console.log(`   POST http://localhost:${PORT}/api/instance/create`);
      console.log(`   GET  http://localhost:${PORT}/api/instance/:id/qrcode`);
      console.log(`   POST http://localhost:${PORT}/api/message/send/text`);
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
