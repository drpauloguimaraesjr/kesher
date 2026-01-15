/**
 * 🚦 Rate Limiter
 * Protege a API contra abuso
 */

const rateLimit = require('express-rate-limit');

const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minuto
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,     // 100 req/min
  message: {
    success: false,
    error: 'Muitas requisições. Tente novamente em 1 minuto.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Usa API Key como identificador (se disponível) ou IP
    return req.headers['x-api-key'] || req.ip;
  }
});

// Rate limiter mais restritivo para envio de mensagens
const messageLimiter = rateLimit({
  windowMs: 60000, // 1 minuto
  max: 30,         // 30 mensagens/min
  message: {
    success: false,
    error: 'Limite de mensagens atingido. Máximo 30/minuto.',
    retryAfter: 60
  }
});

module.exports = { rateLimiter, messageLimiter };
