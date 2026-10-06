#!/bin/sh
# Меняет адрес сайта в уже собранном сайте «Удача» (без node и пересборки).
#
#   sh set-domain.sh https://example.ru  [папка_сайта | архив.zip]
#
# Второй аргумент — распакованная папка сайта (по умолчанию текущая) или zip-архив для хостинга
# (архив будет пересобран на месте; нужны unzip и zip).
# Текущий адрес скрипт берёт из sitemap.xml, поэтому домен можно менять сколько угодно раз.
# Меняются: canonical, og:url, og:image, twitter:image, JSON-LD (url, image) в index.html,
# адрес в sitemap.xml и строка Sitemap в robots.txt. Кириллический домен указывайте в punycode (xn--…).
set -eu

NEW=${1:-}
TARGET=${2:-.}
die() { echo "Ошибка: $*" >&2; exit 1; }

[ -n "$NEW" ] || die "укажите адрес: sh set-domain.sh https://example.ru [папка|архив.zip]"
NEW=$(printf '%s' "$NEW" | sed 's:/*$::')
printf '%s' "$NEW" | grep -Eq '^https?://[A-Za-z0-9.-]+(:[0-9]+)?$' \
  || die "адрес должен быть вида https://example.ru — без пути и пробелов, кириллица в punycode (xn--…): $NEW"

ZIP=""
case "$TARGET" in
  *.zip)
    [ -f "$TARGET" ] || die "нет архива $TARGET"
    command -v unzip >/dev/null && command -v zip >/dev/null || die "для работы с архивом нужны unzip и zip"
    ZIP=$(cd "$(dirname "$TARGET")" && pwd)/$(basename "$TARGET")
    DIR=$(mktemp -d)
    trap 'rm -rf "$DIR"' EXIT
    unzip -q "$ZIP" -d "$DIR"
    ;;
  *) DIR=$TARGET ;;
esac

[ -f "$DIR/index.html" ] || die "в $DIR нет index.html — укажите папку сайта (где лежат index.html и sitemap.xml)"
[ -f "$DIR/sitemap.xml" ] || die "в $DIR нет sitemap.xml"
OLD=$(sed -n 's#.*<loc>\(https\{0,1\}://[^/<]*\)/</loc>.*#\1#p' "$DIR/sitemap.xml" | head -n 1)
[ -n "$OLD" ] || die "не удалось прочитать текущий адрес из sitemap.xml"
if [ "$OLD" = "$NEW" ]; then echo "Адрес уже $NEW — менять нечего."; exit 0; fi

# экранирование для sed (разделитель |)
OLD_RE=$(printf '%s' "$OLD" | sed 's/[][\.*^$|]/\\&/g')
NEW_RE=$(printf '%s' "$NEW" | sed 's/[&|\\]/\\&/g')

echo "Было:  $OLD"
echo "Стало: $NEW"
for f in "$DIR/index.html" "$DIR/sitemap.xml" "$DIR/robots.txt"; do
  [ -f "$f" ] || continue
  n=$(grep -oF "$OLD" "$f" | wc -l | tr -d ' ')
  [ "$n" -gt 0 ] || continue
  sed "s|$OLD_RE|$NEW_RE|g" "$f" > "$f.tmp" && cat "$f.tmp" > "$f" && rm -f "$f.tmp"
  echo "  $(basename "$f"): заменено $n"
done

# проверка: старого адреса нигде не осталось
LEFT=$(grep -rlF "$OLD" "$DIR" 2>/dev/null || true)
[ -z "$LEFT" ] || die "старый адрес остался в: $LEFT"

if [ -n "$ZIP" ]; then
  rm -f "$ZIP"
  (cd "$DIR" && zip -qr -X "$ZIP" .)
  echo "Архив обновлён: $ZIP"
fi
echo "Готово."
