/**
 * 🔐 Middleware de Autenticação
 * Valida API Key em todas as requisições
 */

function authMiddleware(req, res, next) {
  // Rotas públicas (health check)
  const publicPaths = ['/health', '/api/health'];
  if (publicPaths.includes(req.path)) {
    return next();
  }

  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const validApiKey = process.env.API_KEY;

  if (!validApiKey) {
    console.warn('⚠️ [Auth] API_KEY não configurada no .env');
    return next(); // Em dev, permite sem chave
  }

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API Key não fornecida',
      hint: 'Adicione header X-API-Key ou query param apiKey'
    });
  }

  if (apiKey !== validApiKey) {
    return res.status(403).json({
      success: false,
      error: 'API Key inválida'
    });
  }

  next();
}

module.exports = authMiddleware;
