# 🚀 Guia Completo de Setup: Firebase + Railway

## 📋 Checklist Rápido

- [ ] Criar projeto Firebase
- [ ] Ativar Firestore Database
- [ ] Gerar credenciais Service Account
- [ ] Configurar arquivo .env local
- [ ] Testar localmente
- [ ] Criar repositório GitHub
- [ ] Criar projeto Railway
- [ ] Configurar variáveis de ambiente no Railway
- [ ] Deploy!

---

## 🔥 PASSO 1: Criar Projeto Firebase

### 1.1 Acesse o Console Firebase

1. Vá para: https://console.firebase.google.com/
2. Faça login com sua conta Google
3. Clique em **"Adicionar projeto"**

### 1.2 Configure o Projeto

1. Nome do projeto: `whatsapp-api-service` (ou outro nome)
2. Desative o Google Analytics (não necessário)
3. Clique em **"Criar projeto"**
4. Aguarde a criação e clique em **"Continuar"**

---

## 🗄️ PASSO 2: Ativar Firestore Database

### 2.1 Criar o Banco de Dados

1. No menu lateral esquerdo, clique em **"Firestore Database"**
2. Clique em **"Criar banco de dados"**
3. Escolha **"Iniciar no modo de produção"**
4. Selecione a região: `southamerica-east1` (São Paulo)
5. Clique em **"Ativar"**

### 2.2 Configurar Regras de Segurança

1. No Firestore, vá na aba **"Regras"**
2. Substitua as regras por:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Apenas Admin SDK tem acesso (seu backend)
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

3. Clique em **"Publicar"**

---

## 🔐 PASSO 3: Gerar Credenciais do Service Account

### 3.1 Acessar Configurações

1. No Firebase Console, clique na **engrenagem ⚙️** (canto superior esquerdo)
2. Clique em **"Configurações do projeto"**
3. Vá na aba **"Contas de serviço"**

### 3.2 Gerar Chave Privada

1. Em **"SDK Admin do Firebase"**, clique em **"Gerar nova chave privada"**
2. Confirme clicando em **"Gerar chave"**
3. **GUARDE O ARQUIVO JSON EM LOCAL SEGURO!**

### 3.3 Extrair Informações do JSON

Abra o arquivo JSON baixado. Você vai precisar de:

```
FIREBASE_PROJECT_ID = "project_id" do JSON
FIREBASE_CLIENT_EMAIL = "client_email" do JSON
FIREBASE_PRIVATE_KEY = "private_key" do JSON
```

---

## 💻 PASSO 4: Configurar Ambiente Local (.env)

### 4.1 Editar o arquivo .env

1. Abra o arquivo `.env` nesta pasta
2. Preencha com suas credenciais:

```env
# Servidor
PORT=3001
NODE_ENV=development

# Firebase (DO SEU ARQUIVO JSON!)
FIREBASE_PROJECT_ID=whatsapp-api-service-xxxxx
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@whatsapp-api-service.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBg...\n-----END PRIVATE KEY-----\n"

# Gere uma API Key segura (use: https://www.uuidgenerator.net/)
API_KEY=seu-uuid-gerado-aqui

# Outras configurações (pode manter os padrões)
WEBHOOK_SECRET=outro-uuid-gerado
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
SESSION_COLLECTION=whatsapp-sessions
MAX_RECONNECT_ATTEMPTS=3
RECONNECT_INTERVAL_MS=30000
API_BASE_URL=http://localhost:3001
```

⚠️ **IMPORTANTE:** A `FIREBASE_PRIVATE_KEY` deve manter os `\n` como estão no JSON!

---

## 🧪 PASSO 5: Testar Localmente

### 5.1 Iniciar o Servidor

```bash
npm run dev
```

### 5.2 Verificar Health Check

Abra no navegador: http://localhost:3001/health

Deve retornar:

```json
{
  "status": "ok",
  "service": "WhatsApp API Service",
  "version": "1.0.0"
}
```

### 5.3 Testar Criação de Instância

```bash
curl -X POST http://localhost:3001/api/instance/create \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sua-api-key" \
  -d '{"instanceName": "test"}'
```

---

## 📦 PASSO 6: Criar Repositório GitHub

### 6.1 Inicializar Git (se ainda não fez)

```bash
git init
git add .
git commit -m "Initial commit - WhatsApp API Service"
```

### 6.2 Criar Repositório no GitHub

1. Vá para: https://github.com/new
2. Nome: `whatsapp-api-service`
3. Deixe como **privado** (suas credenciais!)
4. NÃO inicialize com README

### 6.3 Fazer Push

```bash
git remote add origin https://github.com/SEU-USUARIO/whatsapp-api-service.git
git branch -M main
git push -u origin main
```

---

## 🚂 PASSO 7: Configurar Railway

### 7.1 Criar Conta

1. Acesse: https://railway.app/
2. Faça login com sua conta **GitHub**
3. Se pedido, adicione um método de pagamento (tem free tier)

### 7.2 Criar Novo Projeto

1. Clique em **"New Project"**
2. Escolha **"Deploy from GitHub repo"**
3. Selecione o repositório `whatsapp-api-service`
4. Railway vai detectar automaticamente que é Node.js

### 7.3 Configurar Variáveis de Ambiente

1. No projeto Railway, clique na aba **"Variables"**
2. Clique em **"+ New Variable"** e adicione TODAS estas:

| Name                      | Value                      |
| ------------------------- | -------------------------- |
| `PORT`                    | `3001`                     |
| `NODE_ENV`                | `production`               |
| `FIREBASE_PROJECT_ID`     | `seu-project-id`           |
| `FIREBASE_CLIENT_EMAIL`   | `seu-client-email`         |
| `FIREBASE_PRIVATE_KEY`    | `sua-private-key` (com \n) |
| `API_KEY`                 | `sua-api-key-segura`       |
| `WEBHOOK_SECRET`          | `seu-webhook-secret`       |
| `RATE_LIMIT_WINDOW_MS`    | `60000`                    |
| `RATE_LIMIT_MAX_REQUESTS` | `100`                      |
| `SESSION_COLLECTION`      | `whatsapp-sessions`        |
| `MAX_RECONNECT_ATTEMPTS`  | `3`                        |
| `RECONNECT_INTERVAL_MS`   | `30000`                    |

⚠️ **DICA para FIREBASE_PRIVATE_KEY no Railway:**

- Clique em "Raw Editor"
- Cole a chave COMPLETA incluindo as aspas e \n

### 7.4 Configurar Domínio

1. Vá em **"Settings"**
2. Em **"Networking"**, clique em **"Generate Domain"**
3. Copie a URL gerada (ex: `https://whatsapp-api.up.railway.app`)

---

## ✅ PASSO 8: Verificar Deploy

### 8.1 Testar Health Check

Acesse: `https://sua-url-railway.up.railway.app/health`

### 8.2 Testar Criação de Instância

```bash
curl -X POST https://sua-url-railway.up.railway.app/api/instance/create \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sua-api-key" \
  -d '{"instanceName": "producao"}'
```

---

## 🔗 ENDPOINTS DA API

### Gerenciamento de Instâncias

| Método | Endpoint                   | Descrição         |
| ------ | -------------------------- | ----------------- |
| POST   | `/api/instance/create`     | Criar instância   |
| GET    | `/api/instance/:id/status` | Status da conexão |
| GET    | `/api/instance/:id/qrcode` | Obter QR Code     |
| DELETE | `/api/instance/:id`        | Remover instância |
| GET    | `/api/instances`           | Listar todas      |

### Envio de Mensagens

| Método | Endpoint                  | Descrição     |
| ------ | ------------------------- | ------------- |
| POST   | `/api/message/send/text`  | Enviar texto  |
| POST   | `/api/message/send/image` | Enviar imagem |
| POST   | `/api/message/send/video` | Enviar vídeo  |
| POST   | `/api/message/send/audio` | Enviar áudio  |

---

## 🆘 Problemas Comuns

### "Firebase não inicializado"

- Verifique se as variáveis de ambiente estão corretas
- Confirme que a PRIVATE_KEY mantém os `\n`

### "Connection refused"

- Railway pode demorar alguns minutos para cold start
- Verifique os logs no Railway Dashboard

### "QR Code não aparece"

- A instância precisa estar conectada primeiro
- Use `/api/instance/{id}/status` para verificar

---

## 📞 Suporte

Se tiver problemas:

1. Verifique os logs no Railway (aba "Deployments" > "View Logs")
2. Confirme todas as variáveis de ambiente
3. Teste localmente primeiro antes de fazer deploy

---

🎉 **Parabéns! Sua API WhatsApp está pronta!**
