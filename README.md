# Tom Hanks App Catalog

Projeto para a disciplina de Computação em Nuvem lecionada pelo professor @siriani. 
Este projeto consiste num catálogo de filmes do Tom Hanks integrado com a API do TMDB e com persistência de dados (favoritos e comentários) individuais por usuário no banco de dados MariaDB.

## Estrutura do Projeto
- `backend/`: API em Node.js (Express)
- `frontend/`: Aplicação web em React (Vite)
- `database/`: Scripts SQL para o MariaDB

## Como rodar localmente

1. Importe o banco de dados utilizando o script em `database/create.sql`.
2. No backend, configure as variáveis de ambiente baseando-se no arquivo `backend/.env.example`.
3. Para rodar o backend:
```bash
cd backend
npm install
npm run dev
```
4. Para rodar o frontend (em outro terminal):
```bash
cd frontend
npm install
npm run dev
```