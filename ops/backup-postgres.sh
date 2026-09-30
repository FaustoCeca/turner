#!/usr/bin/env bash
# Backup diario de la base de Postgres en el VPS.
#
# Instalación (una vez):
#   sudo mkdir -p /opt/turnero && sudo cp backup-postgres.sh /opt/turnero/ && sudo chmod +x /opt/turnero/backup-postgres.sh
#   sudo crontab -u postgres -e      →  agregar:  30 3 * * * /opt/turnero/backup-postgres.sh >> /var/log/turnero-backup.log 2>&1
#
# Restaurar (reemplaza el contenido actual de la base):
#   sudo -u postgres pg_restore --clean --if-exists -d turnero /var/backups/turnero/turnero-AAAA-MM-DD-HHMM.dump
# Probar un backup sin tocar producción:
#   sudo -u postgres createdb turnero_prueba && sudo -u postgres pg_restore -d turnero_prueba ARCHIVO.dump
set -euo pipefail

DB="${DB_NAME:-turnero}"
DIR="${BACKUP_DIR:-/var/backups/turnero}"
KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p "$DIR"
FILE="$DIR/$DB-$(date +%F-%H%M).dump"

# Formato "custom" (-Fc): comprimido y restaurable con pg_restore.
pg_dump -Fc "$DB" > "$FILE.tmp"
mv "$FILE.tmp" "$FILE"

# Se conservan los últimos KEEP_DAYS días.
find "$DIR" -name "$DB-*.dump" -mtime +"$KEEP_DAYS" -delete

# Copia fuera del VPS (recomendado): si configuraste rclone con un remoto llamado "backups"
# (Google Drive, Backblaze, S3…), se sube ahí también. Si el VPS se pierde, el backup no.
if command -v rclone >/dev/null 2>&1 && rclone listremotes | grep -q '^backups:$'; then
  rclone copy "$FILE" "backups:turnero/"
fi

echo "$(date '+%F %T') backup OK: $FILE ($(du -h "$FILE" | cut -f1))"
