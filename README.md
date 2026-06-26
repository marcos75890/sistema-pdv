# Gestão Comercial — Sistema PDV / ERP (front-end)

Sistema de gestão comercial completo (PDV, produtos, clientes, estoque, financeiro e relatórios), construído **100% em front-end** (HTML5, CSS3, JavaScript ES6+, Bootstrap 5, Chart.js, Font Awesome) com persistência em **LocalStorage**. Pronto para publicar no **GitHub Pages** e arquitetado para futura integração com **API/banco de dados** sem reescrever a interface.

> Já vem com os seus dados reais importados do Kyte: **34 produtos**, **75 clientes** e **85 vendas** (a maioria no fiado → viram Contas a Receber).

---

## 🚀 Como usar

### Localmente
Basta abrir o arquivo `index.html` no navegador (duplo clique). Não precisa de servidor.

**Login de demonstração:** `admin@empresa.com` / `admin`

### Publicar no GitHub Pages
1. Crie um repositório no GitHub e envie todos os arquivos desta pasta.
2. Vá em **Settings → Pages**.
3. Em *Source*, selecione a branch `main` e a pasta `/ (root)`.
4. Salve. Em ~1 minuto o sistema estará no ar em `https://SEU-USUARIO.github.io/SEU-REPO/`.

```bash
git init
git add .
git commit -m "Sistema de gestão comercial"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/SEU-REPO.git
git push -u origin main
```

---

## 📁 Estrutura do projeto

```
index.html              → Shell da aplicação (SPA) + carregamento de libs
/css
  style.css             → Design system completo (tema claro/escuro, componentes)
/js
  seed-data.js          → Dados iniciais (importados do Kyte) — carregados 1x
  store.js              → Camada de dados (Repository) — pronta para trocar por API
  app.js                → Núcleo: router, tema, utilitários, componentes, busca
  dashboard.js          → Painel com KPIs, gráficos e rankings
  vendas.js             → PDV + histórico de vendas + comprovante
  produtos.js           → Cadastro de produtos e categorias
  clientes.js           → Cadastro de clientes + histórico de compras
  estoque.js            → Entradas, saídas, ajustes e movimentações
  financeiro.js         → Contas a pagar/receber, fluxo de caixa, resultado
  relatorios.js         → Central de relatórios (exportação PDF e Excel)
  configuracoes.js      → Empresa, aparência, usuários, backup e importação CSV
/assets
  /img  /icons
/docs
  ANALISE-KYTE.md       → Análise do Kyte e melhorias aplicadas
```

---

## 🧱 Arquitetura — preparada para virar um sistema com backend

O ponto central é o **`js/store.js`**. Toda a aplicação fala **somente** com ele (nunca com o `localStorage` direto), e seus métodos são **assíncronos** (`async/await`), simulando uma API desde já:

```js
await Store.list('produtos');          // GET /produtos
await Store.get('produtos', id);       // GET /produtos/:id
await Store.create('produtos', obj);   // POST /produtos
await Store.update('produtos', id, p); // PUT /produtos/:id
await Store.remove('produtos', id);    // DELETE /produtos/:id
```

Para migrar para um banco de dados real no futuro, basta **trocar o `Adapter`** dentro de `store.js` (de `LocalStorageAdapter` para um `ApiAdapter` que usa `fetch`). **Nenhuma tela precisa ser alterada** — as assinaturas continuam idênticas. Há um exemplo comentado no próprio arquivo.

### Padrões usados
- **SPA com roteamento por hash** (`#/dashboard`, `#/vendas`…) → navegação instantânea, sem recarregar.
- **Repository Pattern** + **Adapter** → desacopla a UI da persistência.
- **Pub/Sub** (`Store.subscribe`) → o "chrome" (badges, nome da empresa) se atualiza sozinho.
- **Módulos isolados** → cada tela é um arquivo `js/` independente, registrado em `App.registerModule`.
- **Design tokens** em CSS variables → temas claro/escuro e troca de cor de destaque.

---

## ✨ Funcionalidades

- **Dashboard**: vendas do dia/mês, faturamento, lucro, ticket médio, a pagar/receber, estoque baixo, gráficos (vendas 30 dias, formas de pagamento), top produtos, top clientes, últimas vendas e alertas.
- **PDV**: busca por nome/SKU/código de barras (com Enter p/ scanner), catálogo por categoria, carrinho com desconto/acréscimo, cliente, **múltiplas formas de pagamento** (dinheiro com troco, PIX, crédito com parcelas, débito, fiado), comprovante para impressão, cancelamento e histórico.
- **Produtos**: CRUD, categorias, custo/preço, **margem automática**, foto, estoque mín/atual, ativo/inativo, exportação.
- **Clientes**: CRUD completo, **histórico de compras**, total comprado, última compra, botão **WhatsApp**, detecção automática de clientes bloqueados (“não vender / não paga”).
- **Estoque**: posição, entradas, saídas, ajuste de inventário, histórico e alertas de mínimo.
- **Financeiro**: contas a pagar (com parcelamento) e a receber (baixa total/parcial), fluxo de caixa com saldo, resultado do mês e gráficos.
- **Relatórios**: 9 relatórios com exportação **PDF** e **Excel**.
- **Configurações**: dados/logo da empresa, tema e cor, usuários e permissões, **backup/restauração (JSON)** e **importação de CSV do Kyte**.

### Atalhos
- `/` → foca a busca global.

---

## 🔌 Bibliotecas (via CDN — funcionam offline após cache)
Bootstrap 5.3 · Bootstrap Icons · Font Awesome 6 · Chart.js 4 · jsPDF + AutoTable · SheetJS (xlsx).

## ⚠️ Observações
- Os dados ficam **no navegador** (LocalStorage). Use **Configurações → Dados & Backup** para baixar backups regularmente.
- Login/senha são apenas demonstrativos no front-end; a autenticação real virá com o backend.
