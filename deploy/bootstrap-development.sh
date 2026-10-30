#!/usr/bin/env bash
set -euo pipefail

config_dir=/home/nick/.config/srp
development_env="$config_dir/development.env"
production_env="$config_dir/production.env"
database_name=srp_db_dev
database_user=srp_dev_user

if [[ ! -r "$production_env" ]]; then
  echo "Create the protected production environment first: $production_env" >&2
  exit 1
fi

if [[ -r "$development_env" ]]; then
  echo "Reusing the existing protected development credentials."
  php /home/nick/services/srp-server/srp/deploy/clone-development-schema.php \
    "$production_env" "$development_env" --reset-development
  install -d -m 0700 /home/nick/.local/share/srp-development/uploads
  echo "Development database and environment are ready."
  exit 0
fi

echo "This one-time setup needs sudo to create an isolated MySQL database/user."
sudo -v

database_password=$(openssl rand -hex 24)
encryption_key=$(openssl rand -base64 32)
temporary_sql=$(mktemp)
trap 'rm -f -- "$temporary_sql"' EXIT
chmod 0600 "$temporary_sql"

cat > "$temporary_sql" <<SQL
CREATE DATABASE IF NOT EXISTS \`$database_name\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$database_user'@'localhost' IDENTIFIED BY '$database_password';
ALTER USER '$database_user'@'localhost' IDENTIFIED BY '$database_password';
GRANT ALL PRIVILEGES ON \`$database_name\`.* TO '$database_user'@'localhost';
FLUSH PRIVILEGES;
SQL
sudo /usr/bin/mysql < "$temporary_sql"

install -d -m 0700 "$config_dir"
umask 077
cat > "$development_env" <<ENV
APP_BASE_URL=http://127.0.0.1:3000
DB_HOST=localhost
DB_NAME=$database_name
DB_USER=$database_user
DB_PASS=$database_password
SRP_DEV_MODE=true
DISABLE_TWO_FACTOR=true
CORS_ALLOWED_ORIGINS=http://127.0.0.1:3000,http://localhost:3000
APP_ENCRYPTION_KEY=$encryption_key
ENV
chmod 0600 "$development_env"

php /home/nick/services/srp-server/srp/deploy/clone-development-schema.php \
  "$production_env" "$development_env" --reset-development

install -d -m 0700 /home/nick/.local/share/srp-development/uploads
echo "Development database and environment are ready."
