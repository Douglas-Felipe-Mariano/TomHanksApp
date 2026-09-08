const express = require('express');
const { createClient } = require('redis');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3002;
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const STREAM_KEY = 'auditoria_logs';

const redisClient = createClient({ url: REDIS_URL });

redisClient.on('error', (err) => console.log('Redis Client Error', err));

app.post('/logs', async (req, res) => {
  const { usuario_id, acao } = req.body;
  if (!acao) return res.status(400).json({ error: 'Ação é obrigatória' });
  
  const id = usuario_id ? String(usuario_id) : 'anonimo';

  try {
    await redisClient.xAdd(STREAM_KEY, '*', {
      usuario_id: id,
      acao: acao,
      timestamp: new Date().toISOString()
    });
    res.status(201).json({ message: 'Log registrado' });
  } catch (error) {
    console.error('Erro ao gravar log no Redis:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

app.get('/logs', async (req, res) => {
  try {
    // Busca os logs do stream. O '-' significa o começo e '+' o fim.
    const results = await redisClient.xRange(STREAM_KEY, '-', '+');
    
    // Retorna os mais recentes primeiro limitando a 50
    const logs = results.map(entry => {
      return {
        id: entry.id,
        usuario_id: entry.message.usuario_id,
        acao: entry.message.acao,
        timestamp: entry.message.timestamp
      };
    }).reverse().slice(0, 50); 
    
    res.json(logs);
  } catch (error) {
    console.error('Erro ao buscar logs no Redis:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

const start = async () => {
  await redisClient.connect();
  console.log('Conectado ao Redis');
  
  app.listen(PORT, () => {
    console.log(`Log Service rodando na porta ${PORT}`);
  });
};

start().catch(console.error);
