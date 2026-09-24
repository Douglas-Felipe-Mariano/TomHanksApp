# Tom Hanks App Catalog

Projeto para a disciplina de Computação em Nuvem lecionada pelo professor @siriani.

Esta versão continua o catálogo da atividade 2 e separa a autenticação em um microsserviço interno. O catálogo continua sendo o único container com porta pública; login, cadastro, papéis de usuário e recuperação de senha ficam no serviço `auth-service`, acessível somente pela rede interna do Docker.

## O que mudou

- `app` continua público e serve o catálogo + frontend.
- `auth-service` foi criado para login, cadastro, validação de JWT, role e reset de senha.
- O link de recuperação de senha expira em 30 minutos e é validado antes da troca da senha.
- O envio de e-mail está preparado para Mailtrap no desenvolvimento.

## Estrutura do projeto

- `backend/`: catálogo, favoritos, comentários, proxy interno para autenticação e agregador de rotas de admin
- `auth-service/`: microsserviço de autenticação e recuperação de senha
- `log-service/`: microsserviço de auditoria com persistência em Redis
- `frontend/`: aplicação web em React (Vite)
- `database/`: scripts SQL para o MariaDB

## Logs e Auditoria (Redis Streams)

O sistema conta com uma trilha de auditoria para monitorar as ações. 
- **Persistência**: Utilizamos o **Redis Streams** (`XADD` e `XRANGE`). A escolha do Streams se justifica por ser uma estrutura desenhada nativamente para append-only de eventos ordenados no tempo, o que atende perfeitamente ao caso de uso de auditoria (onde se escreve muito e a ordem é vital), superando a complexidade de gerenciar IDs manuais que uma simples lista (List) exigiria.
- **Eventos Monitorados**: Login (sucesso e falha), logout, criação/remoção de favoritos, criação/remoção de comentários (incluindo moderação) e tentativas de ações negadas por permissão (HTTP 403).
- **Consulta**: Administradores podem visualizar os últimos eventos com `GET /api/admin/logs?limit=50`, autenticado com Bearer token. O parâmetro `limit` aceita de 1 a 500 (padrão 50); os eventos são devolvidos do mais recente para o mais antigo. Usuários comuns recebem 403.
- **Rede**: somente o container `app` publica porta no host. `auth-service`, `log-service` e Redis são acessíveis pela rede interna do Docker Compose.

### Roteiro de demonstração

1. Inicie os serviços com `docker compose up -d --build` e crie/promova uma conta administradora conforme a seção de RBAC abaixo.
2. Entre no frontend com uma conta comum, favorite um filme e publique um comentário.
3. Para demonstrar uma negação por permissão, com a conta comum tente apagar um comentário pertencente a outro usuário. A API deve responder `403` e registrar `tentativa_negada_403_apagar_comentario`.
4. Use **Sair** no frontend. O sistema chama `POST /api/auth/logout` antes de limpar a sessão e registra `logout` no stream.
5. Entre com a conta admin e consulte `GET /api/admin/logs?limit=50` usando o token dessa conta. A consulta mostra `usuario_id`, `acao` e `timestamp`; como vem em ordem mais recente primeiro, o login admin aparece no topo, seguido pelos eventos anteriores.
6. Tente a mesma consulta usando uma conta comum: deve receber HTTP `403`.

Exemplo de consulta da demonstração (substitua o token pelo JWT de uma conta admin):

```bash
curl -H "Authorization: Bearer SEU_TOKEN_ADMIN" "http://localhost:3000/api/admin/logs?limit=50"
```

Após executar o roteiro, capture a resposta JSON da consulta autenticada como admin no terminal ou no navegador e anexe a captura de tela à entrega. A captura depende de uma execução local com usuários e dados reais; ela não é simulada neste repositório.

## Como rodar com Docker Compose

1. Copie o arquivo `.env.example` para `.env` e preencha as variáveis.
2. Se o banco já foi criado na atividade 2, rode primeiro `database/migrate-auth.sql` uma vez.
3. Se for uma instalação nova, importe `database/create.sql`.
4. Suba os containers com:

O `auth-service` executa a migração automaticamente na inicialização, então a coluna `role` e a tabela `reset_tokens` são criadas/ajustadas assim que o serviço sobe.

```bash
docker compose up -d --build
```

## Variáveis importantes

- `RESERVED_PORT`: porta pública do catálogo no Portainer.
- `APP_PUBLIC_URL`: URL pública do catálogo, usada no link do e-mail.
- `SMTP_*`: credenciais do Mailtrap no desenvolvimento.
- `JWT_SECRET`: segredo usado somente pelo `auth-service`.

## Mailtrap no desenvolvimento

1. Crie uma inbox no Mailtrap.
2. Copie o host, porta, usuário e senha de SMTP para as variáveis `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` e `SMTP_PASS`.
3. Ajuste `EMAIL_FROM` se quiser um remetente mais claro no teste.

## Papel de usuário e Permissões (RBAC)

O controle de acesso baseado em papéis (RBAC) está implementado com os papéis `usuario` e `admin`. 

### Permissões por Papel:
- **`usuario` (Usuário Comum):**
  - Autenticar-se (login) e gerenciar sua senha.
  - Pesquisar filmes no catálogo e ver detalhes.
  - Adicionar, listar e remover filmes aos **seus próprios** favoritos.
  - Adicionar comentários e remover **somente os seus próprios** comentários.
  
- **`admin` (Administrador):**
  - Possui todas as permissões do `usuario`.
  - **Ação Exclusiva de Moderação:** Pode remover o comentário de **qualquer usuário**.

Para demonstrar o papel de administrador, promova um usuário no MariaDB:

```sql
UPDATE usuarios SET role = 'admin' WHERE email = 'seu-email@exemplo.com';
```

## Padrão de Arquitetura de Autorização (Padrão A ou B?)

**Resposta: Padrão A (Enforcement Centralizado)**

**Justificativa:** Atualmente, nosso microsserviço principal (Catálogo/Backend) recebe os requests autenticados e, por meio do middleware `auth.js`, faz uma chamada de rede (HTTP GET `/auth/me`) para o `auth-service` em *toda* requisição protegida. Isso centraliza a validação e permite revogação/alteração imediata de papéis, configurando claramente o Padrão A.

**O que mudaria se fosse para o Padrão B?**
Para adotar o Padrão B, o middleware do backend deixaria de fazer a requisição HTTP (`axios.get`) para o `auth-service`. Em vez disso, ele verificaria a validade e a assinatura do JWT localmente (`jwt.verify`) e leria a claim de `role` direto do payload do token. Seria mais rápido (sem latência de rede extra), mas perderíamos a revogação instantânea de um papel, pois a mudança só faria efeito quando o usuário gerasse um novo token (login/refresh).

## Fluxo de recuperação de senha

1. O usuário informa o e-mail na tela de login.
2. O `auth-service` cria um token único em `reset_tokens` com expiração de 30 minutos.
3. O e-mail chega pelo Mailtrap no desenvolvimento.
4. O link abre a página `/reset-password` no catálogo e valida o token antes de trocar a senha.
5. Depois de usado, ou após 30 minutos, o mesmo token é recusado.

## Execução local sem Docker

Se você quiser testar separadamente:

```bash
cd backend
npm install
npm run dev
```

```bash
cd auth-service
npm install
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```