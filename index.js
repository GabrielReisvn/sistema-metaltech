//importando variaveis do .env para configurar o ambiente de desenvolvimento e produção
require('dotenv').config();

// importando dependências
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express(); 
const PORT = process.env.PORT || 3001; // Porta para o servidor

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// importando rotas e iniciando banco
const { ready } = require('./src/database/sqlite');
const routes    = require('./src/routes/index');


// garantindo banco de dados pronto antes de iniciar e configurar rotas do servidor
ready.then(() => {
  
  app.use('/api', routes);

  app.get('/teste', (req, res) => {
    res.json({ mensagem: 'API da Pizzaria funcionando!', status: 'online', porta: PORT });
  });

  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
  // iniciando servidor
  app.listen(PORT, () => {
    console.log('=================================');
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`API: http://localhost:${PORT}/api`);
    console.log(`Front-end: http://localhost:${PORT}`);
    console.log('=================================');
  });
}).catch(err => {
  console.error('Erro ao inicializar banco:', err);
  process.exit(1);
});
