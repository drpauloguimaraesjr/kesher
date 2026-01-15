# 🕎 Kesher API - קֶשֶׁר

> **"Kesher"** (קֶשֶׁר) significa **"Conexão"** em hebraico.  
> Sua API WhatsApp poderosa e confiável.

## 📋 Recursos

- ✅ Multi-instância (conectar vários números)
- ✅ Sessões persistentes no Firebase
- ✅ API REST completa
- ✅ Webhooks para mensagens recebidas
- ✅ Reconexão automática inteligente
- ✅ Rate limiting
- ✅ QR Code via API
- ✅ Envio de texto, imagem, vídeo, áudio

## 🚀 Instalação

```bash
# 1. Instalar dependências
npm install

# 2. Copiar e configurar .env
cp .env.example .env
# Edite .env com suas credenciais Firebase

# 3. Iniciar em desenvolvimento
npm run dev

# 4. Iniciar em produção
npm start
```

## 📡 Endpoints da API

### Instâncias

| Método | Endpoint                   | Descrição               |
| ------ | -------------------------- | ----------------------- |
| POST   | `/api/instance/create`     | Criar nova instância    |
| GET    | `/api/instance/:id/status` | Status da conexão       |
| GET    | `/api/instance/:id/qrcode` | Obter QR Code           |
| DELETE | `/api/instance/:id`        | Desconectar e remover   |
| GET    | `/api/instances`           | Listar todas instâncias |

### Mensagens

| Método | Endpoint                  | Descrição     |
| ------ | ------------------------- | ------------- |
| POST   | `/api/message/send/text`  | Enviar texto  |
| POST   | `/api/message/send/image` | Enviar imagem |
| POST   | `/api/message/send/video` | Enviar vídeo  |
| POST   | `/api/message/send/audio` | Enviar áudio  |

### Webhooks

| Método | Endpoint                | Descrição         |
| ------ | ----------------------- | ----------------- |
| POST   | `/api/webhook/register` | Registrar webhook |
| DELETE | `/api/webhook/:id`      | Remover webhook   |
| GET    | `/api/webhooks`         | Listar webhooks   |

## 🔐 Autenticação

Todas as requisições precisam do header:

```
X-API-Key: sua-chave-api
```

## 📦 Exemplo de Uso

### Criar instância

```bash
curl -X POST http://localhost:3001/api/instance/create \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sua-chave" \
  -d '{"instanceName": "meu-whatsapp"}'
```

### Obter QR Code

```bash
curl http://localhost:3001/api/instance/meu-whatsapp/qrcode \
  -H "X-API-Key: sua-chave"
```

### Enviar mensagem

```bash
curl -X POST http://localhost:3001/api/message/send/text \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sua-chave" \
  -d '{
    "instanceId": "meu-whatsapp",
    "phone": "5511999999999",
    "message": "שלום! (Olá!)"
  }'
```

## 🏗️ Arquitetura

```
src/
├── server.js           # Entrada principal
├── config/
│   └── firebase.js     # Configuração Firebase
├── services/
│   ├── WhatsAppManager.js    # Gerenciador de instâncias
│   └── WhatsAppInstance.js   # Classe de instância única
├── routes/
│   ├── instance.js     # Rotas de instância
│   ├── message.js      # Rotas de mensagem
│   └── webhook.js      # Rotas de webhook
├── middleware/
│   ├── auth.js         # Autenticação API Key
│   └── rateLimiter.js  # Rate limiting
└── utils/
    └── logger.js       # Sistema de logs
```

## 🌐 Deploy Recomendado

| Serviço      | Uso             | Custo                       |
| ------------ | --------------- | --------------------------- |
| **Railway**  | Servidor da API | ~$5/mês                     |
| **Firebase** | Sessões + Banco | Grátis (Spark)              |
| **Vercel**   | NÃO recomendado | Serverless não funciona bem |

### Por que NÃO usar Vercel?

- Vercel é serverless (funções morrem após 10s)
- WhatsApp precisa de conexão persistente (WebSocket)
- Railway mantém o processo rodando 24/7

## 📝 Licença

MIT

---

<div align="center">

### קֶשֶׁר

**Kesher API** - Sua conexão WhatsApp

</div>
