# COMANDOS NO CMD

Execute os comandos abaixo para instalar as dependências do projeto:

```
npm install express cors
npm install sqlite3 sqlite
npm install dotenv
npm install bcrypt
npm install jsonwebtoken
```

---

# ARRUMANDO PASTAS

Estrutura mínima de diretórios e arquivos usados neste projeto:

- Crie a pasta `public/` na raiz e adicione os arquivos estáticos:

```
public/
  script.js
  index.html
  style.css
```

- Crie a pasta `src/` com as subpastas abaixo:

```
src/
  database/
    sqlite.js
  middlewares/
    auth.js
  models/
    Cliente.js
    MateriaPrima.js
    OrdemProducao.js
    Produto.js
    Usuario.js
    
  routes/
    index.js
```

- Arquivos exemplares:
  - `src/database/sqlite.js`
  - `src/middlewares/auth.js`
  - `src/models/Cliente.js`, `src/models/Produto.js`, `src/models/OrdemProducao.js`, `src/models/Usuario.js`

- Arquivo do banco (não versionado): `metaltech.db`

# EXPLICANDO ARQUIVOS

- `index.html` — arquivo front-end (página estática servida em `/`).
- `public/script.js` — lógica do front-end (requisições para a API, manipulação do DOM).
- `public/style.css` — estilos do front-end.
- `index.js` — ponto de entrada do servidor: carrega variáveis de ambiente, configura middlewares, aguarda `ready` do banco e monta as rotas em `/api`.
- `package.json` — lista de dependências e scripts úteis (`start`, `dev`, `seed`).
- `seed.js` — script para popular o banco com dados iniciais .
- `pizzaria.db` — arquivo SQLite gerado por `sql.js` (não versionar).

- `src/database/sqlite.js` — inicializa `sql.js`, cria o arquivo de DB (`DB_PATH`) se necessário, cria as tabelas e exporta `ready` (Promise) e os helpers `query`, `get`, `run`, `salvar`.
  - Observação: `run()` grava alterações e chama `salvar()` para persistir o arquivo `metaltech.db`.

- `src/middlewares/auth.js` — middleware JWT: extrai `Authorization: Bearer <token>`, valida com `process.env.JWT_SECRET` e popula `req.usuario` com o payload.

- `src/models/Usuario.js` — modelo de usuários. Métodos: `findAll`, `findByEmail`, `findById`, `create`, `update`, `delete`, `verificarSenha`. Usa `bcryptjs` para hashing e formata a saída (ex.: `ativo` → booleano).

- `src/models/Produto.js` — modelo de produtos: campos como `nome`, `peso, tempo de producao`, `precos` (JSON). Implementa operações CRUD via os helpers do DB.

- `src/models/Cliente.js` — modelo de clientes: CRUD básico e busca por critérios (ex.: `busca` query em rotas).

- `src/models/OrdemProducao.js` — modelo de pedidos: cria pedidos com itens,  expõe `create`, `findAll` (aceita filtros), `findById`, `updateStatus`, `delete`.

- `src/routes/index.js` — define as rotas REST principais (`/auth/login`, `/pizzas`, `/clientes`, `/pedidos`, `/usuarios`), aplica `auth` middleware nas rotas protegidas e checa `req.usuario.perfil` para permissões (ex.: somente `Administrador` pode criar/ler `/usuarios`).

- `readme.md` — este arquivo: instruções rápidas sobre instalação e estrutura do projeto.

# EPLICANDO SITE

## Modelos (models)

Abaixo estão os modelos de página presentes com uma breve descrição do que cada um expõe e quais operações é esperado que realizem.

## **_TELA DE LOGIN_**

<img src="./img/login.png" width="500" height="auto">

```
Objetivo: autenticar usuário via email/senha e obter token JWT.

Elementos principais: campos email e senha, botão Entrar, mensagens de erro/toast.

Ações: validar campos, enviar /api/auth/login, armazenar token e dados do usuário em localStorage, alternar para a interface principal (body.logado).

Permissões: disponível a todos; funções exibidas depois do login conforme perfil.

```

## **_Dashboard_** 📊

<img src="./img/dashboard.png" width="500" height="auto">

``` 
Objetivo: visão geral rápida de estatísticas e indicadores (vendas, pedidos, clientes, pizzas).

Elementos principais: cards de estatísticas, gráficos/resumos, atalhos para criar pizza/pedido.

Ações: exibir totais, filtros rápidos (período), navegar para páginas detalhadas (Pedidos, Pizzas, Clientes).

Permissões: visível para usuários autenticados; conteúdo pode variar por perfil.
```

## **_Ordem de produção_** 📋

<img src="./img/pedido.png" width="500" height="auto">

``` 
Objetivo: gerenciar pedidos (criar, visualizar, atualizar status, cancelar).

Elementos principais: lista/tabela de pedidos com cliente, itens, total e status; modal de criação/edição; botão para alterar status.

Ações:
  - Criar pedido: selecionar cliente (ou novo), adicionar itens (produto, qtd).
  - Editar/Atualizar status: mudar entre recebido → em_preparo → saiu_entrega → entregue / cancelar.
  - Excluir/cancelar pedido e ver histórico.

Permissões: lideres podem criar e atualizar; administradores têm controle completo.

```

## **_Produtos_** 🔩

<img src="./img/pizza.png" width="500" height="auto">

``` 
Objetivo: CRUD das peças e configuração de preços por tamanho.

Elementos principais: tabela/lista de peças, botões criar/editar/excluir, modal com campos (nome, peso, preços, disponibilidade).

Ações:
  - Criar/Editar: informar nome, peso, preços , categoria e disponibilidade.
  - Deletar: remover peça (com confirmação).
  - Buscar/filtrar por nome ou categoria.

Permissões: geralmente restrito a usuários com permissão de gestão (gerente).

```

## **_Clientes_** 👥

<img src="./img/clientes.png" width="500" height="auto">

``` 
Objetivo: gerenciar cadastro de clientes (endereços, telefone, observações).

Elementos principais: lista de clientes, busca incremental, modal de criação/edição, botão deletar.

Ações:
  - Buscar por nome/telefone (debounce no front-end).
  - Criar/Editar cliente com endereço completo e observações.
  - Remover ou marcar como inativo.

Permissões: disponível para atendentes/garçons; administradores também.
```

## **_Estoque/Materia Prima_** 📦

```
Objetivo: gerenciar cadastro do estoque (endereços, telefone, observações).

Elementos principais: lista de materia prima, busca incremental, modal de criação/edição, botão deletar.

Ações:
  - gerenciar movimentações de materias primas utilizadas na produção
    com entrada, saida e quantidade em kg 
  - em caso de estoque baixo avisa para o gerente.

Permissões: disponível para gerentes; 
```


## **_Usuários_** 🔐

<img src="./img/suarios.png" width="500" height="auto">
```

Objetivo: administração de contas do sistema (somente para administradores).

Elementos principais: tabela de usuários com perfil, status (ativo/inativo), botões criar/editar/excluir.

Ações:
  - Criar usuário com perfil (Administrador, Garcom, Atendente), hashear senha no back-end.
  - Ativar/Desativar usuário, editar permissões básicas.
  - Restrições: rota protegida por middleware JWT e autorização por perfil.
 
Permissões: apenas gerentes podem acessar e modificar.
```
