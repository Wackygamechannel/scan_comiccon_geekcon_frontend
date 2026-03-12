# Используем официальный образ Node.js, соответствующий требованиям Next.js 16 (>=20.9.0)
FROM node:20-alpine

# Устанавливаем рабочую директорию внутри контейнера
WORKDIR /app

# Копируем package.json и package-lock.json (или yarn.lock)
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем все файлы проекта в контейнер
COPY . .

# Собираем проект для продакшн
RUN npm run build

# Открываем порт для Next.js
EXPOSE 3000

# Запускаем приложение в продакшн-режиме
CMD ["npm", "start"]
