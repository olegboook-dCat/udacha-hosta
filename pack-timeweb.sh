#!/bin/sh
# Упаковывает собранный dist/ в zip для обычного хостинга (Timeweb): index.html и .htaccess — в корне архива.
#   npm run build && sh pack-timeweb.sh [путь/к/архиву.zip]     (по умолчанию ../udacha-timeweb.zip)
set -eu
cd "$(dirname "$0")"
OUT=${1:-../udacha-timeweb.zip}
mkdir -p "$(dirname "$OUT")"
OUT="$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")"
[ -f dist/index.html ] && [ -f dist/.htaccess ] || { echo "Сначала соберите: npm run build" >&2; exit 1; }
rm -f "$OUT"
(cd dist && zip -qr -X "$OUT" . -x '.DS_Store' '*/.DS_Store' '*.map' 'vercel.json' 'README*' 'node_modules/*')
cp set-domain.sh "$(dirname "$OUT")/set-domain.sh"
echo "Архив: $OUT ($(wc -c < "$OUT" | tr -d ' ') байт), рядом set-domain.sh"
