# WhatsApp → Chatwoot Name Sync

Serviço que sincroniza automaticamente mudanças de nome do WhatsApp para o Chatwoot usando webhooks da Evolution API v2.

## 📋 Funcionalidades

- ✅ Detecta mudanças de nome no WhatsApp
- ✅ Atualiza automaticamente no Chatwoot
- ✅ Suporta múltiplas instâncias Evolution
- ✅ Logs detalhados para debug
- ✅ Health check endpoint
- ✅ Endpoint de teste manual

## 🚀 Como Funciona

1. Evolution API detecta mudança de nome no contato do WhatsApp
2. Envia webhook `contacts.update` para este serviço
3. Serviço busca o contato no Chatwoot pelo número de telefone
4. Atualiza o nome do contato no Chatwoot

## 📦 Instalação

### Opção 1: Deploy no Easypanel

1. No Easypanel, crie um novo serviço
2. Escolha "Deploy from GitHub" ou faça upload dos arquivos
3. Configure as variáveis de ambiente (veja abaixo)
4. Deploy!

### Opção 2: Docker

```bash
# Build
docker build -t whatsapp-chatwoot-sync .

# Run
docker run -d \
  -p 3000:3000 \
  -e CHATWOOT_URL=https://chatwoot.seudominio.com \
  -e CHATWOOT_API_TOKEN=seu_token \
  -e CHATWOOT_ACCOUNT_ID=1 \
  --name whatsapp-sync \
  whatsapp-chatwoot-sync
```

### Opção 3: Node.js Local

```bash
# Instalar dependências
npm install

# Configurar .env
cp .env.example .env
# Editar .env com suas credenciais

# Iniciar
npm start
```

## ⚙️ Configuração

### 1. Obter Token da API do Chatwoot

1. Acesse seu Chatwoot
2. Vá em **Configurações** → **Integrações** → **Chaves de API**
3. Crie uma nova chave de API
4. Copie o token gerado

### 2. Variáveis de Ambiente

Crie um arquivo `.env` com:

```bash
# URL do seu Chatwoot (sem / no final)
CHATWOOT_URL=https://chatwoot.seudominio.com

# Token da API do Chatwoot
CHATWOOT_API_TOKEN=seu_token_api_aqui

# ID da conta do Chatwoot (geralmente 1)
CHATWOOT_ACCOUNT_ID=1

# Porta do servidor (opcional)
PORT=3000

# Mapeamento de instâncias (opcional, para uso futuro)
INSTANCE_INBOX_MAP={}
```

### 3. Configurar Webhook na Evolution API

**IMPORTANTE**: A Evolution API v2 deve estar configurada para enviar webhooks.

#### Método 1: Via Interface da Evolution (se disponível)

1. Acesse a interface da Evolution API
2. Vá em Configurações da Instância
3. Configure o Webhook URL para: `https://seu-dominio.com/webhook/evolution`
4. Ative os eventos: `contacts.update` e `messages.upsert`

#### Método 2: Via API da Evolution

```bash
curl -X POST https://evolution.seudominio.com/instance/setWebhook/NOME_DA_INSTANCIA \
  -H "Content-Type: application/json" \
  -H "apikey: SUA_API_KEY" \
  -d '{
    "enabled": true,
    "url": "https://seu-servico.com/webhook/evolution",
    "events": [
      "CONTACTS_UPDATE",
      "MESSAGES_UPSERT"
    ]
  }'
```

#### Método 3: Editar Diretamente no Docker/Easypanel

Se você tem acesso ao arquivo de configuração da Evolution, adicione:

```yaml
WEBHOOK:
  ENABLED: true
  URL: https://seu-servico.com/webhook/evolution
  EVENTS:
    - CONTACTS_UPDATE
    - MESSAGES_UPSERT
```

## 🧪 Testando

### 1. Health Check

```bash
curl http://localhost:3000/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "config": {
    "chatwootConfigured": true,
    "instanceMappings": 0
  }
}
```

### 2. Teste Manual de Sincronização

```bash
curl -X POST http://localhost:3000/test/sync \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "5511999999999",
    "newName": "João Silva"
  }'
```

### 3. Teste Real

1. No WhatsApp, mude o nome de um contato
2. Aguarde alguns segundos
3. Verifique no Chatwoot se o nome foi atualizado
4. Verifique os logs do serviço

## 📊 Logs

O serviço emite logs detalhados:

```
📨 Evento recebido: contacts.update
📱 Contato atualizado: 5511999999999 -> João Silva (Instância: minha_empresa)
✅ Contato 12345 atualizado para: João Silva
✅ Sincronização concluída: João -> João Silva
```

## 🔍 Troubleshooting

### Contato não encontrado no Chatwoot

**Problema**: `⚠️ Contato não encontrado no Chatwoot`

**Solução**: 
- Verifique se o contato existe no Chatwoot
- Certifique-se de que o número de telefone está no formato correto
- O contato deve ter tido pelo menos uma conversa antes

### Webhook não está sendo recebido

**Problema**: Nenhum log de evento aparece

**Solução**:
1. Verifique se o webhook está configurado na Evolution API
2. Teste se a URL está acessível: `curl https://seu-dominio.com/health`
3. Verifique os logs da Evolution API
4. Certifique-se de que não há firewall bloqueando

### Erro de autenticação no Chatwoot

**Problema**: `Erro ao buscar contato no Chatwoot: 401`

**Solução**:
- Verifique se o `CHATWOOT_API_TOKEN` está correto
- Confirme que o token tem permissões para ler/editar contatos
- Verifique se o `CHATWOOT_ACCOUNT_ID` está correto

## 🔐 Segurança

Para produção, recomendo:

1. **Adicionar autenticação ao webhook**:
```javascript
// Adicione no index.js antes do app.post('/webhook/evolution')
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

app.use('/webhook/evolution', (req, res, next) => {
  const secret = req.headers['x-webhook-secret'];
  if (secret !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

2. **Usar HTTPS**: Configure SSL no Easypanel
3. **Rate Limiting**: Adicione express-rate-limit
4. **Variáveis sensíveis**: Use secrets do Easypanel

## 📝 Estrutura do Projeto

```
whatsapp-chatwoot-sync/
├── index.js           # Aplicação principal
├── package.json       # Dependências
├── Dockerfile        # Container Docker
├── .env.example      # Template de configuração
└── README.md         # Esta documentação
```

## 🤝 Contribuindo

Sugestões e melhorias são bem-vindas!

## 📄 Licença

MIT

## 🆘 Suporte

Se tiver problemas:
1. Verifique a seção de Troubleshooting
2. Ative logs detalhados
3. Verifique os logs da Evolution API e Chatwoot
