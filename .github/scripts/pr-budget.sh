#!/usr/bin/env bash
# Считает, сколько раз агента уже запускали для этого pull request, и решает,
# можно ли вызывать модель ещё раз.
#
# Источник счётчика: история GitHub Actions. Запуск считается допущенным, если
# в нём успешно отработало задание budget, то есть команду дал доверенный
# участник. Учитывается каждая попытка: повтор через Re-run, отмена и тайм-аут
# агента тоже расходуют бюджет. Запуски без команды и запуски, отменённые
# в очереди до проверки, не считаются. Токен агента историю запусков изменить
# не может, поэтому текст комментариев на бюджет не влияет.
set -euo pipefail

: "${NUMBER:?номер issue или pull request}"
: "${IS_PR:?true для pull request}"
: "${LIMIT:?предел запусков на pull request}"
: "${RUN_ID:?идентификатор текущего запуска}"

title="opencode #${NUMBER}"

run_ids=$(
  gh api --paginate \
    "repos/${GITHUB_REPOSITORY}/actions/workflows/opencode.yml/runs?per_page=100" \
    --jq ".workflow_runs[]
          | select(.display_title == \"${title}\")
          | select(.id <= ${RUN_ID})
          | .id"
)

# Текущая попытка: её задание budget ещё выполняется и в истории не завершено.
used=1
for run_id in $run_ids; do
  admitted=$(
    gh api --paginate \
      "repos/${GITHUB_REPOSITORY}/actions/runs/${run_id}/jobs?filter=all&per_page=100" \
      --jq '.jobs[] | select(.name == "budget" and .conclusion == "success") | .id' |
      wc -l
  )
  used=$((used + admitted))
done

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
