#!/usr/bin/env bash
set -euo pipefail

production_env=/home/nick/.config/srp/production.env
development_env=/home/nick/.config/srp/development.env
production_uploads=/home/nick/.local/share/srp-deployment/shared/uploads
development_uploads=/home/nick/services/srp-server/srp/uploads

echo "Refreshing development from a one-way production snapshot."
echo "All existing development database changes will be replaced."

php /home/nick/services/srp-server/srp/deploy/clone-development-schema.php \
  "$production_env" \
  "$development_env" \
  --reset-development \
  --include-data

# Copy production media needed to exercise avatars, banners, verification, and
# reel flows. Do not delete development-only files and never synchronize in the
# opposite direction.
rsync -a "$production_uploads/" "$development_uploads/"

SRP_ENV_FILE="$development_env" php -r '
    require "backend/db_connection.php";
    $db = getDB();
    foreach (["users", "communities", "forums", "threads", "posts", "messages"] as $table) {
        echo $table . "=" . $db->query("SELECT COUNT(*) FROM `{$table}`")->fetchColumn() . PHP_EOL;
    }
    echo "user_sessions=" . $db->query("SELECT COUNT(*) FROM user_sessions")->fetchColumn() . PHP_EOL;
'

echo "Development refresh complete. Production was read only."
