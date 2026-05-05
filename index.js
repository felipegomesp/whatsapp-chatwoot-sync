import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const CHATWOOT_URL = process.env.CHATWOOT_URL; // Ex: https://chatwoot.seudominio.com
const CHATWOOT_API_TOKEN = process.env.CHATWOOT_API_TOKEN;
const CHATWOOT_ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID;

// Mapeamento de instâncias Evolution para Inbox IDs do Chatwoot
// Formato: { "nome_da_instancia": "inbox_id" }
const INSTANCE_INBOX_MAP = JSON.parse(process.env.INSTANCE_INBOX_MAP || '{}');

/**
 * Busca um contato no Chatwoot pelo número de telefone
 */
async function findChatwootContact(phoneNumber) {
  try {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    
    const response = await axios.get(
      `${CHATWOOT_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/contacts/search`,
      {
        params: { q: cleanPhone },
        headers: {
          'api_access_token': CHATWOOT_API_TOKEN
        }
      }
    );

    // Buscar contato que tenha o número exato
    const contact = response.data.payload.find(c => 
      c.phone_number && c.phone_number.replace(/\D/g, '') === cleanPhone
    );

    return contact;
  } catch (error) {
    console.error('Erro ao buscar contato no Chatwoot:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Atualiza o nome de um contato no Chatwoot
 */
async function updateChatwootContactName(contactId, newName) {
  try {
    const response = await axios.patch(
      `${CHATWOOT_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/contacts/${contactId}`,
      {
        name: newName
      },
      {
        headers: {
          'api_access_token': CHATWOOT_API_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Contato ${contactId} atualizado para: ${newName}`);
    return response.data;
  } catch (error) {
    console.error('Erro ao atualizar contato no Chatwoot:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Processa evento de atualização de contato do WhatsApp
 */
async function handleContactUpdate(eventData) {
  try {
    const { instance, data } = eventData;
    
    // Validar se temos os dados necessários
    if (!data || !data.id || !data.pushName) {
      console.log('⚠️  Dados incompletos no evento de contato');
      return;
    }

    const phoneNumber = data.id.replace('@s.whatsapp.net', '');
    const newName = data.pushName;

    console.log(`📱 Contato atualizado: ${phoneNumber} -> ${newName} (Instância: ${instance})`);

    // Buscar contato no Chatwoot
    const chatwootContact = await findChatwootContact(phoneNumber);

    if (!chatwootContact) {
      console.log(`⚠️  Contato ${phoneNumber} não encontrado no Chatwoot`);
      return;
    }

    // Verificar se o nome realmente mudou
    if (chatwootContact.name === newName) {
      console.log(`ℹ️  Nome já está atualizado no Chatwoot: ${newName}`);
      return;
    }

    // Atualizar nome no Chatwoot
    await updateChatwootContactName(chatwootContact.id, newName);
    
    console.log(`✅ Sincronização concluída: ${chatwootContact.name} → ${newName}`);

  } catch (error) {
    console.error('Erro ao processar atualização de contato:', error);
  }
}

/**
 * Processa evento de atualização de mensagem (inclui mudanças de nome via vCard)
 */
async function handleMessageUpdate(eventData) {
  try {
    const { data } = eventData;
    
    // Verificar se é uma mensagem de contato (vCard)
    if (data?.message?.contactMessage) {
      const contact = data.message.contactMessage;
      const phoneNumber = data.key.remoteJid.replace('@s.whatsapp.net', '');
      const displayName = contact.displayName;

      if (displayName) {
        console.log(`📇 vCard recebido: ${phoneNumber} -> ${displayName}`);
        
        // Buscar e atualizar no Chatwoot
        const chatwootContact = await findChatwootContact(phoneNumber);
        
        if (chatwootContact && chatwootContact.name !== displayName) {
          await updateChatwootContactName(chatwootContact.id, displayName);
        }
      }
    }
  } catch (error) {
    console.error('Erro ao processar mensagem:', error);
  }
}

/**
 * Endpoint para receber webhooks da Evolution API
 */
app.post('/webhook/evolution', async (req, res) => {
  try {
    const event = req.body;
    
    console.log(`\n📨 Evento recebido: ${event.event}`);

    // Processar diferentes tipos de eventos
    switch (event.event) {
      case 'contacts.update':
        await handleContactUpdate(event);
        break;
      
      case 'messages.upsert':
        await handleMessageUpdate(event);
        break;
      
      default:
        console.log(`ℹ️  Evento ${event.event} ignorado`);
    }

    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    config: {
      chatwootConfigured: !!CHATWOOT_URL && !!CHATWOOT_API_TOKEN,
      instanceMappings: Object.keys(INSTANCE_INBOX_MAP).length
    }
  });
});

/**
 * Endpoint de teste manual
 */
app.post('/test/sync', async (req, res) => {
  try {
    const { phoneNumber, newName } = req.body;
    
    if (!phoneNumber || !newName) {
      return res.status(400).json({ error: 'phoneNumber e newName são obrigatórios' });
    }

    const contact = await findChatwootContact(phoneNumber);
    
    if (!contact) {
      return res.status(404).json({ error: 'Contato não encontrado no Chatwoot' });
    }

    await updateChatwootContactName(contact.id, newName);
    
    res.json({ 
      success: true, 
      message: `Contato ${contact.id} atualizado para: ${newName}` 
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 WhatsApp → Chatwoot Sync rodando na porta ${PORT}`);
  console.log(`📡 Webhook URL: http://localhost:${PORT}/webhook/evolution`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
  console.log(`\n⚙️  Configuração:`);
  console.log(`   - Chatwoot URL: ${CHATWOOT_URL || 'NÃO CONFIGURADO'}`);
  console.log(`   - Account ID: ${CHATWOOT_ACCOUNT_ID || 'NÃO CONFIGURADO'}`);
  console.log(`   - API Token: ${CHATWOOT_API_TOKEN ? '✓ Configurado' : '✗ NÃO CONFIGURADO'}`);
  console.log(`   - Instâncias mapeadas: ${Object.keys(INSTANCE_INBOX_MAP).length}`);
  console.log('\n');
});
