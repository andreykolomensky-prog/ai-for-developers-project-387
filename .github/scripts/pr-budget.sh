#!/usr/bin/env bash
# Считает, сколько раз агента уже запускали для этого pull request, и решает,
# можно ли вызывать модель ещё раз.
#
# Источник счётчика: история GitHub Actions. Учитывается каждый допущенный
# запуск воркфлоу opencode с тем же номером PR, включая текущий, и каждая его
# попытка: повтор через Re-run, отмена и тайм-аут тоже расходуют бюджет.
# Пропущенные запуски, где в комментарии не было команды, не считаются.
# Токен агента историю запусков изменить не может, поэтому текст комментариев
# на бюджет не влияет.
set -euo pipefail

: "${NUMBER:?номер issue или pull request}"
: "${IS_PR:?true для pull request}"
: "${LIMIT:?предел запусков на pull request}"
: "${RUN_ID:?идентификатор текущего запуска}"

title="opencode #${NUMBER}"

used=$(
  gh api --paginate \
    "repos/${GITHUB_REPOSITORY}/actions/workflows/opencode.yml/runs?per_page=100" \
    --jq ".workflow_runs[]
          | select(.display_title == \"${title}\")
          | select(.conclusion != \"skipped\")
          | select(.id <= ${RUN_ID})
          | .run_attempt" |
    awk '{ total += $1 } END { print total + 0 }'
)

allowed=true
if [ "$IS_PR" = "true" ] && [ "$used" -gt "$LIMIT" ]; then
  allowed=false
fi

echo "Запусков агента для #${NUMBER}: ${used}, предел для pull request: ${LIMIT}, допущен: ${allowed}"
{
  echo "used=${used}"
  echo "limit=${LIMIT}"
  echo "allowed=${allowed}"
} >>"$GITHUB_OUTPUT"
