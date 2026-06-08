const express       = require('express');
const jwt           = require('jsonwebtoken');
const router        = express.Router();
const auth          = require('../middlewares/auth');

// ----------------------------------------------------------------
// IMPORTS CORRETOS DOS MODELS
// ----------------------------------------------------------------
const Usuario       = require('../models/Usuario');
const Produto       = require('../models/Produto');
const Cliente       = require('../models/Cliente');
const OrdemProducao = require('../models/OrdemProducao');
const MateriaPrima  = require('../models/MateriaPrima');

// ================================================================
// AUTH
// ================================================================

// POST /auth/login — autentica usuário e retorna token JWT (8h)
router.post('/auth/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha)
      return res.status(400).json({ erro: 'E-mail e senha são obrigatórios' });

    const usuario = await Usuario.findByEmail(email);
    if (!usuario)
      return res.status(401).json({ erro: 'Credenciais inválidas' });

    const ok = await Usuario.verificarSenha(senha, usuario.senha);
    if (!ok)
      return res.status(401).json({ erro: 'Credenciais inválidas' });

    if (!usuario.ativo)
      return res.status(403).json({ erro: 'Usuário inativo. Contate o administrador.' });

    const payload = { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil };
    const token   = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

    res.json({ token, usuario: payload });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// ================================================================
// PRODUTOS (peças industriais)
// ================================================================

// GET /produtos — lista produtos; aceita ?categoria= e ?apenasDisponiveis=true
router.get('/produtos', auth, async (req, res) => {
  try {
    const filtros = {
      categoria:        req.query.categoria,
      apenasDisponiveis: req.query.apenasDisponiveis === 'true',
    };
    res.json(await Produto.findAll(filtros));
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// GET /produtos/:id
router.get('/produtos/:id', auth, async (req, res) => {
  try {
    const p = await Produto.findById(req.params.id);
    if (!p) return res.status(404).json({ erro: 'Produto não encontrado' });
    res.json(p);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// POST /produtos — somente Gerente pode cadastrar peças
router.post('/produtos', auth, async (req, res) => {
  try {
    if (req.usuario.perfil !== 'Gerente')
      return res.status(403).json({ erro: 'Acesso restrito a Gerentes' });

    const { nome, codigo } = req.body;
    if (!nome || !codigo)
      return res.status(400).json({ erro: 'Nome e código são obrigatórios' });

    res.status(201).json(await Produto.create(req.body));
  } catch (e) {
    if (e.message?.includes('UNIQUE'))
      return res.status(400).json({ erro: 'Código de produto já cadastrado' });
    res.status(500).json({ erro: e.message });
  }
});

// PUT /produtos/:id — somente Gerente
router.put('/produtos/:id', auth, async (req, res) => {
  try {
    if (req.usuario.perfil !== 'Gerente')
      return res.status(403).json({ erro: 'Acesso restrito a Gerentes' });

    const p = await Produto.update(req.params.id, req.body);
    if (!p) return res.status(404).json({ erro: 'Produto não encontrado' });
    res.json(p);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// DELETE /produtos/:id — soft delete, marca como indisponível
router.delete('/produtos/:id', auth, async (req, res) => {
  try {
    if (req.usuario.perfil !== 'Gerente')
      return res.status(403).json({ erro: 'Acesso restrito a Gerentes' });

    const ok = await Produto.delete(req.params.id);
    if (!ok) return res.status(404).json({ erro: 'Produto não encontrado' });
    res.json({ mensagem: 'Produto marcado como indisponível' });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// ================================================================
// CLIENTES
// ================================================================

// GET /clientes — aceita ?busca=texto (nome, cnpj ou telefone)
router.get('/clientes', auth, async (req, res) => {
  try { res.json(await Cliente.findAll(req.query.busca)); }
  catch (e) { res.status(500).json({ erro: e.message }); }
});

// GET /clientes/:id
router.get('/clientes/:id', auth, async (req, res) => {
  try {
    const c = await Cliente.findById(req.params.id);
    if (!c) return res.status(404).json({ erro: 'Cliente não encontrado' });
    res.json(c);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// POST /clientes
router.post('/clientes', auth, async (req, res) => {
  try {
    const { nome, cnpjCpf } = req.body;
    if (!nome || !cnpjCpf)
      return res.status(400).json({ erro: 'Nome e CNPJ/CPF são obrigatórios' });

    res.status(201).json(await Cliente.create(req.body));
  } catch (e) {
    if (e.message?.includes('UNIQUE'))
      return res.status(400).json({ erro: 'CNPJ/CPF já cadastrado' });
    res.status(500).json({ erro: e.message });
  }
});

// PUT /clientes/:id
router.put('/clientes/:id', auth, async (req, res) => {
  try {
    const c = await Cliente.update(req.params.id, req.body);
    if (!c) return res.status(404).json({ erro: 'Cliente não encontrado' });
    res.json(c);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// DELETE /clientes/:id — soft delete
router.delete('/clientes/:id', auth, async (req, res) => {
  try {
    const ok = await Cliente.delete(req.params.id);
    if (!ok) return res.status(404).json({ erro: 'Cliente não encontrado' });
    res.json({ mensagem: 'Cliente desativado' });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// ================================================================
// ORDENS DE PRODUÇÃO
// ================================================================

// GET /ordens — aceita ?liderId= e ?status=
router.get('/ordens', auth, async (req, res) => {
  try {
    const filtros = {};
    // Líder só vê as próprias ordens; Gerente vê todas (ou filtra por liderId)
    if (req.usuario.perfil === 'Lider') {
      filtros.liderId = req.usuario.id;
    } else if (req.query.liderId) {
      filtros.liderId = req.query.liderId;
    }
    if (req.query.status) filtros.status = req.query.status;

    res.json(await OrdemProducao.findAll(filtros));
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// GET /ordens/:id
router.get('/ordens/:id', auth, async (req, res) => {
  try {
    const o = await OrdemProducao.findById(req.params.id);
    if (!o) return res.status(404).json({ erro: 'Ordem não encontrada' });
    res.json(o);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// POST /ordens — cria nova ordem de produção
router.post('/ordens', auth, async (req, res) => {
  try {
    const { clienteId, itens, prazoEntrega } = req.body;
    if (!clienteId || !itens?.length || !prazoEntrega)
      return res.status(400).json({ erro: 'clienteId, itens e prazoEntrega são obrigatórios' });

    const nova = await OrdemProducao.create({
      clienteId,
      itens,
      prazoEntrega,
      prioridade:  req.body.prioridade,
      observacoes: req.body.observacoes,
      liderId:     req.body.liderId || req.usuario.id,
    });
    res.status(201).json(nova);
  } catch (e) { res.status(400).json({ erro: e.message }); }
});

// PATCH /ordens/:id/status — avança o status respeitando a máquina de estados
// Fluxo: aguardando → em_producao → finalizado | cancelado
router.patch('/ordens/:id/status', auth, async (req, res) => {
  try {
    const statusValidos = ['aguardando', 'em_producao', 'finalizado', 'cancelado'];
    if (!statusValidos.includes(req.body.status))
      return res.status(400).json({
        erro: `Status inválido. Use: ${statusValidos.join(', ')}`,
      });

    const o = await OrdemProducao.updateStatus(req.params.id, req.body.status);
    res.json(o);
  } catch (e) {
    // updateStatus lança erro descritivo para transição inválida ou ordem não encontrada
    res.status(400).json({ erro: e.message });
  }
});

// PATCH /ordens/:id/lider — atribui ou reatribui um líder à ordem (somente Gerente)
router.patch('/ordens/:id/lider', auth, async (req, res) => {
  try {
    if (req.usuario.perfil !== 'Gerente')
      return res.status(403).json({ erro: 'Acesso restrito a Gerentes' });

    if (!req.body.liderId)
      return res.status(400).json({ erro: 'liderId é obrigatório' });

    const o = await OrdemProducao.atribuirLider(req.params.id, req.body.liderId);
    if (!o) return res.status(404).json({ erro: 'Ordem não encontrada' });
    res.json(o);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// DELETE /ordens/:id — só apaga ordens com status 'aguardando'
router.delete('/ordens/:id', auth, async (req, res) => {
  try {
    if (req.usuario.perfil !== 'Gerente')
      return res.status(403).json({ erro: 'Acesso restrito a Gerentes' });

    const ok = await OrdemProducao.delete(req.params.id);
    if (!ok) return res.status(404).json({ erro: 'Ordem não encontrada' });
    res.json({ mensagem: 'Ordem removida' });
  } catch (e) {
    // delete lança erro descritivo se a ordem já passou de 'aguardando'
    res.status(400).json({ erro: e.message });
  }
});
// ================================================================
// MATÉRIAS-PRIMAS E ESTOQUE
// ================================================================
 
// GET /materias-primas — lista todas; aceita ?apenasEstoqueBaixo=true
router.get('/materias-primas', auth, async (req, res) => {
  try {
    const filtros = {
      apenasEstoqueBaixo: req.query.apenasEstoqueBaixo === 'true',
    };
    res.json(await MateriaPrima.findAll(filtros));
  } catch (e) { res.status(500).json({ erro: e.message }); }
});
 
// GET /materias-primas/:id
router.get('/materias-primas/:id', auth, async (req, res) => {
  try {
    const mp = await MateriaPrima.findById(req.params.id);
    if (!mp) return res.status(404).json({ erro: 'Matéria-prima não encontrada' });
    res.json(mp);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});
 
// POST /materias-primas — somente Gerente cadastra
router.post('/materias-primas', auth, async (req, res) => {
  try {
    if (req.usuario.perfil !== 'Gerente')
      return res.status(403).json({ erro: 'Acesso restrito a Gerentes' });
 
    const { nome, codigo } = req.body;
    if (!nome || !codigo)
      return res.status(400).json({ erro: 'Nome e código são obrigatórios' });
 
    res.status(201).json(await MateriaPrima.create(req.body));
  } catch (e) {
    if (e.message?.includes('UNIQUE'))
      return res.status(400).json({ erro: 'Código de matéria-prima já cadastrado' });
    res.status(500).json({ erro: e.message });
  }
});
 
// PUT /materias-primas/:id — somente Gerente
router.put('/materias-primas/:id', auth, async (req, res) => {
  try {
    if (req.usuario.perfil !== 'Gerente')
      return res.status(403).json({ erro: 'Acesso restrito a Gerentes' });
 
    const mp = await MateriaPrima.update(req.params.id, req.body);
    if (!mp) return res.status(404).json({ erro: 'Matéria-prima não encontrada' });
    res.json(mp);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});
 
// GET /materias-primas/:id/movimentacoes — histórico de uma MP
router.get('/materias-primas/:id/movimentacoes', auth, async (req, res) => {
  try {
    const limite = parseInt(req.query.limite) || 50;
    res.json(await MateriaPrima.findMovimentacoes(req.params.id, { limite }));
  } catch (e) { res.status(500).json({ erro: e.message }); }
});
 
// GET /movimentacoes — visão geral de todas as movimentações (somente Gerente)
router.get('/movimentacoes', auth, async (req, res) => {
  try {
    if (req.usuario.perfil !== 'Gerente')
      return res.status(403).json({ erro: 'Acesso restrito a Gerentes' });
 
    const limite = parseInt(req.query.limite) || 100;
    res.json(await MateriaPrima.findTodasMovimentacoes({ limite }));
  } catch (e) { res.status(500).json({ erro: e.message }); }
});
 
// POST /materias-primas/:id/movimentacoes — registra entrada ou saída
router.post('/materias-primas/:id/movimentacoes', auth, async (req, res) => {
  try {
    const { tipo, quantidade, ordemId, observacoes } = req.body;
    if (!tipo || !quantidade)
      return res.status(400).json({ erro: 'Tipo e quantidade são obrigatórios' });
 
    const resultado = await MateriaPrima.registrarMovimentacao({
      materiaPrimaId: req.params.id,
      tipo,
      quantidade:     parseFloat(quantidade),
      ordemId:        ordemId || null,
      observacoes:    observacoes || '',
      usuarioId:      req.usuario.id,
    });
 
    // Avisa se o estoque ficou abaixo do mínimo após a saída
    if (resultado.estoqueBaixo) {
      return res.status(201).json({
        ...resultado,
        aviso: '⚠️ Estoque abaixo do mínimo após esta movimentação. Considere repor.',
      });
    }
 
    res.status(201).json(resultado);
  } catch (e) {
    // Erros de negócio (saldo insuficiente, tipo inválido) → 400
    res.status(400).json({ erro: e.message });
  }
});
 

// ================================================================
// USUÁRIOS — somente Gerente gerencia usuários
// ================================================================

// GET /usuarios
router.get('/usuarios', auth, async (req, res) => {
  try {
    if (req.usuario.perfil !== 'Gerente')
      return res.status(403).json({ erro: 'Acesso restrito a Gerentes' });
    res.json(await Usuario.findAll());
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// POST /usuarios
router.post('/usuarios', auth, async (req, res) => {
  try {
    if (req.usuario.perfil !== 'Gerente')
      return res.status(403).json({ erro: 'Acesso restrito a Gerentes' });

    const { nome, email, senha, perfil } = req.body;
    if (!nome || !email || !senha)
      return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios' });

    res.status(201).json(await Usuario.create({ nome, email, senha, perfil }));
  } catch (e) {
    if (e.message?.includes('UNIQUE'))
      return res.status(400).json({ erro: 'E-mail já cadastrado' });
    res.status(500).json({ erro: e.message });
  }
});

// PUT /usuarios/:id
router.put('/usuarios/:id', auth, async (req, res) => {
  try {
    if (req.usuario.perfil !== 'Gerente')
      return res.status(403).json({ erro: 'Acesso restrito a Gerentes' });

    const u = await Usuario.update(req.params.id, req.body);
    if (!u) return res.status(404).json({ erro: 'Usuário não encontrado' });
    res.json(u);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// DELETE /usuarios/:id — soft delete
router.delete('/usuarios/:id', auth, async (req, res) => {
  try {
    if (req.usuario.perfil !== 'Gerente')
      return res.status(403).json({ erro: 'Acesso restrito a Gerentes' });

    const ok = await Usuario.delete(req.params.id);
    if (!ok) return res.status(404).json({ erro: 'Usuário não encontrado' });
    res.json({ mensagem: 'Usuário desativado' });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;