# Tom Hanks App Catalog

Projeto para a disciplina de Computação em Nuvem lecionada pelo professor @siriani.

Esta versão continua o catálogo da atividade 2 e separa a autenticação em um microsserviço interno. O catálogo continua sendo o único container com porta pública; login, cadastro, papéis de usuário e recuperação de senha ficam no serviço `auth-service`, acessível somente pela rede interna do Docker.

## O que mudou

- `app` continua público e serve o catálogo + frontend.
- `auth-service` foi criado para login, cadastro, validação de JWT, role e reset de senha.
- O link de recuperação de senha expira em 30 minutos e é validado antes da troca da senha.
- O envio de e-mail está preparado para Mailtrap no desenvolvimento.

## Estrutura do projeto

- `backend/`: catálogo, favoritos, comentários e proxy interno para autenticação
- `auth-service/`: microsserviço de autenticação e recuperação de senha
- `frontend/`: aplicação web em React (Vite)
- `database/`: scripts SQL para o MariaDB

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

## Papel de usuário

O serviço já grava `role` em `usuarios` com os valores `usuario` e `admin`. Para demonstrar o papel de administrador, promova um usuário no MariaDB com algo como:

```sql
UPDATE usuarios SET role = 'admin' WHERE email = 'seu-email@exemplo.com';
```

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