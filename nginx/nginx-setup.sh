#!/bin/bash
set -e

NGINX_DIR="${1:-./nginx}"
CONF_FILES=($(find "$NGINX_DIR" -maxdepth 1 -type f -name '*.conf' | sort))

if [ ${#CONF_FILES[@]} -eq 0 ]; then
  echo "❌ .conf файлы не найдены в $NGINX_DIR"
  exit 1
fi

for CONF_FILE in "${CONF_FILES[@]}"; do
  BASENAME=$(basename "$CONF_FILE")
  BASENAME_NOEXT=${BASENAME%.conf}
  DOMAIN=$(grep -m1 -Eo 'server_name\s+[^;]+' "$CONF_FILE" | awk '{print $2}')
  DOMAIN=${DOMAIN:-${BASENAME%.conf}}

  BACKEND_PORT=$(grep -oP '(?<=proxy_pass http://127\.0\.0\.1:)\d+' "$CONF_FILE" | head -n 1)
  BACKEND_PORT=${BACKEND_PORT:-8000}

  echo "\n🔗 Создаём симлинк для $DOMAIN..."
  sudo ln -sf "$(realpath "$CONF_FILE")" "/etc/nginx/sites-enabled/$BASENAME_NOEXT"
  echo "   → proxy_pass 127.0.0.1:$BACKEND_PORT"
done

printf '\n🧪 Проверка nginx конфигурации...\n'
sudo nginx -t || { echo "❌ Конфиг содержит ошибки!"; exit 1; }

printf '\n🔄 Перезагрузка nginx...\n'
sudo systemctl reload nginx

printf '\n🎉 Готово!\n'

# Запуск
# chmod +x ./nginx/nginx-setup.sh
# ./nginx/nginx-setup.sh
