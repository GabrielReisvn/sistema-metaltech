// requisitando as funções de acesso ao banco de dados SQLite
const { ready, query, run, get } = require('../database/sqlite');

// Consulta SQL base para obter os dados do pedido junto com as informações do cliente
const SELECT_PEDIDO = `
  SELECT
    p.*,
    c.nome     AS cliente_nome,
    c.telefone AS cliente_telefone
  FROM pedidos p
  LEFT JOIN clientes c ON c.id = p.cliente_id
`;
// Função auxiliar para formatar os dados do banco no formato esperado pela API, incluindo os itens do pedido
function formatarPedido(row, itens = []) {
  if (!row) return null;
  return {
    _id:           row.id,
    id:            row.id,
    numeroPedido:  row.numero_pedido,
    cliente: {
      _id:      row.cliente_id,
      id:       row.cliente_id,
      nome:     row.cliente_nome,
      telefone: row.cliente_telefone,
    },
    itens: itens.map(it => ({
      _id:           it.id,
      pizza:         it.pizza_id,
      nomePizza:     it.nome_pizza,
      tamanho:       it.tamanho,
      quantidade:    it.quantidade,
      precoUnitario: it.preco_unitario,
      subtotal:      it.subtotal,
    })),
    subtotal:       row.subtotal,
    taxaEntrega:    row.taxa_entrega,
    total:          row.total,
    formaPagamento: row.forma_pagamento,
    troco:          row.troco,
    status:         row.status,
    observacoes:    row.observacoes,
    mesa:           row.mesa,
    origem:         row.origem,
    garcom:         row.garcom_id,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
  };
}

// OBJETO DE MODELO DE PEDIDO COM MÉTODOS PARA CRUD E CONSULTAS ESPECÍFICAS
const Pedido = {

  async findAll({ garcomId } = {}) {
    await ready;
    let rows;
    if (garcomId) {
      rows = query(`${SELECT_PEDIDO} WHERE p.garcom_id = ? ORDER BY p.created_at DESC`, [garcomId]);// Se um garçomId for fornecido, filtra os pedidos por garçom
    } else {
      rows = query(`${SELECT_PEDIDO} ORDER BY p.created_at DESC`); 
    }
    return rows.map(row => {
      const itens = query('SELECT * FROM itens_pedido WHERE pedido_id = ?', [row.id]);
      return formatarPedido(row, itens);
    });
  },

  // Busca um pedido pelo ID, incluindo os itens do pedido
  async findById(id) {
    await ready;
    const row = get(`${SELECT_PEDIDO} WHERE p.id = ?`, [id]);
    if (!row) return null;
    const itens = query('SELECT * FROM itens_pedido WHERE pedido_id = ?', [id]);
    return formatarPedido(row, itens);
  },

  // Cria um novo pedido com os dados fornecidos, calculando subtotal, total e número do pedido automaticamente
  async create({ clienteId, itens, taxaEntrega = 0, formaPagamento, troco = 0, observacoes = '', mesa = null, origem = 'balcao', garcomId = null }) {
    await ready;

    const Pizza = require('./Pizza');
    let subtotal = 0;
    const itensProcessados = [];
    
    for (const item of itens) {
      const pizza = await Pizza.findById(item.pizza);
      if (!pizza) throw new Error(`Pizza ID ${item.pizza} não encontrada`);

      const preco   = pizza.precos[item.tamanho] || 0;
      const subItem = preco * item.quantidade;
      subtotal     += subItem;
      
      itensProcessados.push({
        pizzaId:       pizza.id,
        nomePizza:     pizza.nome,
        tamanho:       item.tamanho,
        quantidade:    item.quantidade,
        precoUnitario: preco,
        subtotal:      subItem,
      });
    }
    // Calculando o total do pedido somando o subtotal dos itens e a taxa de entrega (se houver)

    const total        = subtotal + (taxaEntrega || 0);
    const contagem     = get('SELECT COUNT(*) as total FROM pedidos');
    const numeroPedido = (contagem?.total || 0) + 1;

    // Inserindo o pedido na tabela de pedidos e obtendo o ID gerado para associar os itens do pedido
    const infoPedido = run(`
      INSERT INTO pedidos
        (numero_pedido, cliente_id, subtotal, taxa_entrega, total,
         forma_pagamento, troco, observacoes, mesa, origem, garcom_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [numeroPedido, clienteId, subtotal, taxaEntrega || 0, total,
        formaPagamento, troco || 0, observacoes, mesa, origem, garcomId]);

    const pedidoId = infoPedido.lastInsertRowid;
    
    // Inserindo os itens do pedido na tabela de itens_pedido, associando cada item ao ID do pedido recém-criado
    for (const it of itensProcessados) {
      run(`
        INSERT INTO itens_pedido
          (pedido_id, pizza_id, nome_pizza, tamanho, quantidade, preco_unitario, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [pedidoId, it.pizzaId, it.nomePizza, it.tamanho, it.quantidade, it.precoUnitario, it.subtotal]);
    }

    return this.findById(pedidoId);
  },

  // Atualiza o status de um pedido específico, retornando o pedido atualizado ou null se o pedido não for encontrado
  async updateStatus(id, status) {
    await ready;
    const info = run(
      "UPDATE pedidos SET status = ?, updated_at = datetime('now') WHERE id = ?",
      [status, id]
    );
    return info.changes > 0 ? this.findById(id) : null;
  },

  // Deleta um pedido e seus itens associados, retornando true se o pedido foi deletado ou false se o pedido não for encontrado
  async delete(id) {
    await ready;
    run('DELETE FROM itens_pedido WHERE pedido_id = ?', [id]);
    const info = run('DELETE FROM pedidos WHERE id = ?', [id]);
    return info.changes > 0;
  },
};

// EXPORTANDO O MODELO DE PEDIDO PARA USO NAS ROTAS E OUTRAS PARTES DO SISTEMA
module.exports = Pedido;
