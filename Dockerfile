# Build do Frontend
FROM node:20-alpine AS build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Build do Backend e Servidor
FROM node:20-alpine
WORKDIR /app

# Copia os arquivos do backend
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install

# Copia o código do backend
COPY backend/ ./

# Volta pra raiz pra copiar o build do frontend
WORKDIR /app
COPY --from=build /app/frontend/dist ./frontend/dist

# Expõe a porta que o Node vai usar
EXPOSE 3000

# Variáveis de ambiente padrão
ENV PORT=3000
ENV NODE_ENV=production

WORKDIR /app/backend
CMD ["npm", "start"]
