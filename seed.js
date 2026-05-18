require('dotenv').config();
const { ready, run, query } = require('./src/database/sqlite');
const bcrypt = require('bcryptjs');

async function seed() {
  try {
    await ready;
    console.log('🧹 Limpando banco...');

    // Apaga na ordem correta para respeitar as chaves estrangeiras
    run('DELETE FROM movimentacoes_estoque');
    run('DELETE FROM itens_ordem');
    run('DELETE FROM ordens_producao');
    run('DELETE FROM materias_primas');
    run('DELETE FROM produtos');
    run('DELETE FROM clientes');
    run('DELETE FROM usuarios');

    try {
      run(`DELETE FROM sqlite_sequence WHERE name IN (
        'movimentacoes_estoque','itens_ordem','ordens_producao',
        'materias_primas','produtos','clientes','usuarios'
      )`);
    } catch (_) { /* tabela sqlite_sequence só existe após o primeiro INSERT */ }

    console.log('✅ Banco limpo');

    // ----------------------------------------------------------------
    // USUÁRIOS
    // Perfis: Gerente (web admin) | Lider (app mobile)
    // ----------------------------------------------------------------
    const hash = await bcrypt.hash('123456', 10);

    run('INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)',
      ['Carlos Mendonça', 'gerente@metaltech.com', hash, 'Gerente']);
    run('INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)',
      ['João Aparecido', 'lider1@metaltech.com', hash, 'Lider']);
    run('INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)',
      ['Marcos Vinícius', 'lider2@metaltech.com', hash, 'Lider']);
    run('INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)',
      ['Rodrigo Ferraz', 'lider3@metaltech.com', hash, 'Lider']);

    console.log('✅ 4 usuários criados (1 Gerente, 3 Líderes)');

    // ----------------------------------------------------------------
    // CLIENTES (empresas industriais)
    // ----------------------------------------------------------------
    const clientes = [
      ['Construtora Almeida & Filhos',   '12.345.678/0001-90', '(11) 3322-1100', 'contato@almeidafilhos.com.br',   {rua:'Av. das Indústrias',numero:'1500',bairro:'Distrito Industrial',cidade:'São Paulo',cep:'04701-000'},    'Pedidos urgentes toda última semana do mês'],
      ['Siderúrgica Nortão Ltda',         '23.456.789/0001-01', '(11) 4455-2200', 'compras@nortao.com.br',          {rua:'Rua do Ferro',numero:'300',bairro:'Parque Industrial',cidade:'Guarulhos',cep:'07140-000'},             ''],
      ['Metalforte Indústria S.A.',        '34.567.890/0001-12', '(11) 5566-3300', 'suprimentos@metalforte.com.br', {rua:'Rod. Presidente Dutra',numero:'Km 221',bairro:'Cumbica',cidade:'Guarulhos',cep:'07230-000'},           'Requer certificado de qualidade em cada lote'],
      ['Engepec Equipamentos',             '45.678.901/0001-23', '(19) 3344-4400', 'engepec@engepec.com.br',         {rua:'Av. João Jorge',numero:'900',bairro:'Jardim Conceição',cidade:'Campinas',cep:'13036-000'},             ''],
      ['Hidráulica Sul Ltda',              '56.789.012/0001-34', '(11) 2233-5500', 'pedidos@hidraulicasul.com.br',   {rua:'Rua Tuiuti',numero:'440',bairro:'Vila Industrial',cidade:'São Paulo',cep:'03086-000'},                'Entrega somente às terças e quintas'],
      ['Transportes Pesados Omega',        '67.890.123/0001-45', '(11) 9988-6600', 'manutencao@omega.com.br',        {rua:'Av. do Estado',numero:'6000',bairro:'Ipiranga',cidade:'São Paulo',cep:'04231-030'},                   'Cliente VIP — prioridade máxima'],
      ['Agro Maquinas do Cerrado',         '78.901.234/0001-56', '(64) 3322-7700', 'compras@agrocerrado.com.br',     {rua:'Rua Goiás',numero:'150',bairro:'Centro',cidade:'Rio Verde',cep:'75900-000'},                         'Prazo de entrega crítico — safra'],
      ['Mineração Pico Alto',              '89.012.345/0001-67', '(31) 3211-8800', 'suprimentos@picoalto.com.br',   {rua:'Rod. BR-040',numero:'Km 512',bairro:'Zona Industrial',cidade:'Belo Horizonte',cep:'30620-000'},        ''],
      ['Frigorífico Central Oeste',        '90.123.456/0001-78', '(67) 3344-9900', 'manut@fricocentraloeste.com.br', {rua:'Av. Filinto Müller',numero:'1800',bairro:'Carandá Bosque',cidade:'Campo Grande',cep:'79032-000'},     'Peças em aço inox obrigatório'],
      ['Porto Seco Logística',             '01.234.567/0001-89', '(13) 3455-0011', 'operacoes@portoseco.com.br',     {rua:'Av. Portuária',numero:'200',bairro:'Macuco',cidade:'Santos',cep:'11015-000'},                        ''],
    ];

    for (const [nome, cnpj, tel, email, end, obs] of clientes) {
      run('INSERT INTO clientes (nome, cnpj_cpf, telefone, email, endereco, observacoes) VALUES (?, ?, ?, ?, ?, ?)',
        [nome, cnpj, tel, email, JSON.stringify(end), obs]);
    }
    console.log('✅ 10 clientes criados');

    // ----------------------------------------------------------------
    // PRODUTOS (peças fabricadas pela MetalTech)
    // ----------------------------------------------------------------
    const produtos = [
      ['Viga de Aço W150',        'Perfil estrutural W150 para construção civil',          'VIG-W150',  'un',   85.0,  4.0,  320.00, 'estrutural'],
      ['Chapa Expandida 3mm',     'Chapa expandida em aço carbono 3mm 1000x2000mm',        'CHP-EXP3',  'un',   18.5,  1.5,  210.00, 'chapa'],
      ['Tubo Quadrado 50x50',     'Tubo quadrado aço carbono 50x50x3mm barra 6m',          'TUB-Q50',   'un',   12.3,  0.75, 145.00, 'tubo'],
      ['Tubo Redondo 2"',         'Tubo redondo aço carbono 2 polegadas barra 6m',          'TUB-R2',    'un',   9.8,   0.5,  120.00, 'tubo'],
      ['Eixo Torneado 40mm',      'Eixo torneado em aço 1020 diâmetro 40mm comprimento 300mm', 'EIX-40', 'un',  3.1,   2.0,  185.00, 'usinagem'],
      ['Flange DN50',             'Flange de pescoço soldável DN50 classe 150',             'FLG-DN50',  'un',   2.4,   1.0,   95.00, 'flange'],
      ['Suporte Soldado Tipo A',  'Suporte em aço carbono com pintura eletrostática',       'SUP-A',     'un',   4.2,   3.0,  270.00, 'soldagem'],
      ['Engrenagem Helicoidal M4','Engrenagem helicoidal módulo 4, 30 dentes, aço 4140',   'ENG-H4-30', 'un',   1.8,   5.0,  480.00, 'usinagem'],
      ['Grelha Industrial 600x600','Grelha em barra chata aço carbono 600x600mm malha 30', 'GRL-600',   'un',   22.0,  2.5,  310.00, 'estrutural'],
      ['Tampa de Inspeção DN200', 'Tampa cega flangeada DN200 aço carbono',                 'TAM-DN200', 'un',   6.5,   1.5,  165.00, 'flange'],
      ['Mola de Compressão C12',  'Mola de compressão aço mola diâmetro 12mm',              'MOL-C12',   'un',   0.1,   0.5,   28.00, 'mola'],
      ['Cantoneira 2"x2"',        'Cantoneira abas iguais 2x2 polegadas barra 6m',          'CAN-2X2',   'un',   8.2,   0.5,   98.00, 'estrutural'],
    ];

    for (const [nome, desc, cod, uni, peso, tempo, preco, cat] of produtos) {
      run(`INSERT INTO produtos
             (nome, descricao, codigo, unidade_medida, peso_estimado_kg, tempo_producao_h, preco_unitario, categoria)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [nome, desc, cod, uni, peso, tempo, preco, cat]);
    }
    console.log('✅ 12 produtos criados');

    // ----------------------------------------------------------------
    // MATÉRIAS-PRIMAS
    // ----------------------------------------------------------------
    const materias = [
      ['Aço Carbono 1020 (barra)', 'ACO-1020-B',   'kg',   850.0, 100.0, 8.50,  'Distribuição Santos Aço'],
      ['Aço Inox 304 (chapa)',     'ACO-INOX-304', 'kg',   320.0,  50.0, 22.00, 'Açotec Inox Ltda'],
      ['Aço 4140 (barra)',         'ACO-4140-B',   'kg',   210.0,  40.0, 11.80, 'Distribuição Santos Aço'],
      ['Aço Mola',                 'ACO-MOLA',     'kg',    95.0,  20.0, 14.50, 'SpringSteel Brasil'],
      ['Eletrodo de Solda 6013',   'ELET-6013',    'kg',    48.0,  10.0,  9.00, 'Soldas & Cia'],
      ['Tinta Eletrostática Preta','TINTA-ELET-PT','kg',    30.0,   8.0, 35.00, 'Pinturas Industriais ABC'],
      ['Disco de Corte 9"',        'DISCO-CORTE9', 'un',   200.0,  50.0,  4.50, 'Abrasivos Norte'],
      ['Óleo de Corte Solúvel',    'OLEO-CORTE',   'l',    120.0,  20.0,  6.80, 'LubriTech'],
    ];

    for (const [nome, cod, uni, qtd, minimo, preco, fornecedor] of materias) {
      run(`INSERT INTO materias_primas
             (nome, codigo, unidade_medida, quantidade_estoque, quantidade_minima, preco_unitario, fornecedor)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [nome, cod, uni, qtd, minimo, preco, fornecedor]);
    }
    console.log('✅ 8 matérias-primas criadas');

    // ----------------------------------------------------------------
    // ORDENS DE PRODUÇÃO (exemplos de cada status)
    // ----------------------------------------------------------------
    const ordens = [
      // [clienteId, liderId, prazo, status, prioridade, observacoes, total, iniciado_em, finalizado_em]
      [1, 2, '2026-06-10', 'aguardando',   'alta',    'Cliente solicitou certificado de qualidade',  960.00,  null,                       null],
      [2, 2, '2026-06-05', 'em_producao',  'urgente', 'Entregar antes do feriado',                  1440.00, "datetime('now','-2 days')", null],
      [3, 3, '2026-05-30', 'finalizado',   'normal',  '',                                            480.00,  "datetime('now','-5 days')", "datetime('now','-1 day')"],
      [4, 3, '2026-06-15', 'aguardando',   'normal',  'Verificar tolerância do eixo',                555.00,  null,                       null],
      [6, 2, '2026-05-25', 'finalizado',   'urgente', 'VIP — entrega expressa realizada',           1920.00, "datetime('now','-8 days')", "datetime('now','-3 days')"],
      [5, 4, '2026-06-20', 'aguardando',   'baixa',   '',                                            290.00,  null,                       null],
      [7, 4, '2026-06-01', 'em_producao',  'alta',    'Safra próxima — não atrasar',                 960.00,  "datetime('now','-1 day')", null],
      [1, 3, '2026-06-25', 'cancelado',    'normal',  'Cliente cancelou — projeto suspenso',         0.00,    null,                       null],
    ];

    ordens.forEach(([cliId, lidId, prazo, status, prior, obs, total, iniciado, finalizado], i) => {
      const numero = i + 1;
      const iniciadoSql  = iniciado  ? `, iniciado_em = ${iniciado}`  : '';
      const finalizadoSql= finalizado ? `, finalizado_em = ${finalizado}` : '';

      run(`INSERT INTO ordens_producao
             (numero_ordem, cliente_id, lider_id, prazo_entrega, status, prioridade, observacoes, total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [numero, cliId, lidId, prazo, status, prior, obs, total]);

      const ordemId = query('SELECT MAX(id) as id FROM ordens_producao')[0].id;

      if (iniciado || finalizado) {
        run(`UPDATE ordens_producao
               SET ${iniciado ? `iniciado_em = ${iniciado}` : 'iniciado_em = iniciado_em'}
                   ${finalizado ? `, finalizado_em = ${finalizado}` : ''}
             WHERE id = ?`, [ordemId]);
      }
    });

    console.log('✅ 8 ordens de produção criadas (variados status)');

    // ----------------------------------------------------------------
    // ITENS DAS ORDENS (exemplos)
    // ----------------------------------------------------------------
    const itensOrdens = [
      // ordem 1: 3x Viga W150
      [1, 1, 'Viga de Aço W150',         3,  320.00,  960.00],
      // ordem 2: 5x Tubo Redondo 2" + 3x Flange DN50
      [2, 4, 'Tubo Redondo 2"',           5,  120.00,  600.00],
      [2, 6, 'Flange DN50',               3,   95.00,  285.00],
      // ordem 3: 2x Engrenagem Helicoidal M4
      [3, 8, 'Engrenagem Helicoidal M4',  2,  480.00,  960.00],
      // ordem 4: 3x Eixo Torneado
      [4, 5, 'Eixo Torneado 40mm',        3,  185.00,  555.00],
      // ordem 5: 6x Suporte Soldado Tipo A
      [5, 7, 'Suporte Soldado Tipo A',    6,  270.00, 1620.00],
      // ordem 6: 2x Mola de Compressão
      [6,11, 'Mola de Compressão C12',   10,   28.00,  280.00],
      // ordem 7: 3x Grelha Industrial
      [7, 9, 'Grelha Industrial 600x600', 3,  310.00,  930.00],
    ];

    for (const [ordemId, prodId, nomeProd, qtd, precoUnit, subtotal] of itensOrdens) {
      run(`INSERT INTO itens_ordem
             (ordem_id, produto_id, nome_produto, quantidade, preco_unitario, subtotal)
           VALUES (?, ?, ?, ?, ?, ?)`,
        [ordemId, prodId, nomeProd, qtd, precoUnit, subtotal]);
    }
    console.log('✅ Itens das ordens inseridos');

    // ----------------------------------------------------------------
    // MOVIMENTAÇÕES DE ESTOQUE (entradas e saídas de exemplo)
    // ----------------------------------------------------------------
    const movs = [
      // Entradas (compras)
      [1, null, 'entrada', 500.0, 'Compra inicial de aço 1020',   1],
      [2, null, 'entrada', 200.0, 'Compra inicial de inox 304',    1],
      [3, null, 'entrada', 150.0, 'Compra inicial de aço 4140',    1],
      // Saídas vinculadas a ordens finalizadas
      [1,    3, 'saida',    12.5, 'Consumo ordem #3 — engrenagens',2],
      [1,    5, 'saida',     9.0, 'Consumo ordem #5 — suportes',   2],
      [4, null, 'entrada',  50.0, 'Reposição aço mola',            1],
    ];

    for (const [mpId, ordemId, tipo, qtd, obs, usuId] of movs) {
      run(`INSERT INTO movimentacoes_estoque
             (materia_prima_id, ordem_id, tipo, quantidade, observacoes, usuario_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
        [mpId, ordemId, tipo, qtd, obs, usuId]);
    }
    console.log('✅ Movimentações de estoque inseridas');

    console.log('\n======================================');
    console.log('🔥 SEED METALTECH EXECUTADO COM SUCESSO!');
    console.log('======================================');
    console.log('👔 Gerente  → gerente@metaltech.com  | Senha: 123456');
    console.log('🔧 Líder 1  → lider1@metaltech.com   | Senha: 123456');
    console.log('🔧 Líder 2  → lider2@metaltech.com   | Senha: 123456');
    console.log('🔧 Líder 3  → lider3@metaltech.com   | Senha: 123456');
    console.log('======================================\n');
    process.exit(0);

  } catch (err) {
    console.error('❌ ERRO NO SEED:', err);
    process.exit(1);
  }
}

seed();