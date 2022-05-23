# tinkoff-robot
Пример торгового робота для [Tinkoff Invest Api v2](https://tinkoff.github.io/investAPI/) на Node.js.

* использует комбинацию нескольких сигналов
* работает одновременно с несколькими figi
* учитывает комиссию брокера
* не требует баз данных

## Подготовка
1. Склонируйте репозиторий
   ```
   git clone https://github.com/vitalets/tinkoff-robot.git
   ```
2. Установите зависимости
   ```
   cd tinkoff-robot && npm ci
   ```

## Настройка окружения
Создайте в корне файл `.env` и положите в него [токен](https://tinkoff.github.io/investAPI/token/) и номера счетов:
```
# Тинькоф API токен
TINKOFF_API_TOKEN=...
# ID боевого счете
REAL_ACCOUNT_ID=...
# ID счета в песочнице
SANDBOX_ACCOUNT_ID=...
```

> Для создания счета в песочнице запустите: `npx ts-node-esm scripts/create-account.ts`

> Для просмотра информации по всем счетам запустите: `npm run accounts`

## Конфигурация робота
Конфиг находится в файле [src/config.ts](src/config.ts), все поля с комментариями.
Роботу можно одновременно задать несколько figi с разными параметрами стратегии.

## Описание стратегии
Cтратегия использует комбинацию 3-х сигналов на покупку / продажу:

* отклонение текущей цены (takeProfit / stopLoss)
* пересечение скользящих средних (SMA)
* индекс относительной силы (RSI)

Сейчас используется простейший вариант - если сработал хотя бы один сигнал, применяем его.

После срабатывания сигнала проверяется достаточно ли средств для этого действия.
Если средств достаточно, выставляется лимит-заявка.
При повторном сигнале заявка перевыставляется с более актуальной ценой.
Также алгоритм сейчас действует аккуратно: больше инструмент уже куплен, то дополнительно он не докупается.

## Запуск на исторических данных
Проверка робота на исторических данных сделана с помощью [tinkoff-local-broker](https://github.com/vitalets/tinkoff-local-broker).

1. [Запустите](https://github.com/vitalets/tinkoff-local-broker#запуск-сервера) локальный брокер в отдельном окне терминала
2. Установите нужный диапазон дат в файле `scripts/run-bakctest.ts`
3. Запустите `npm run backtest`

<details>
<summary>Примерный вывод:</summary>

```
[robot]: Запуск робота (песочница)
[portfolio]: Позиции загружены: 1
[portfolio]:      BBG004731354 1 x 401.05
[orders]: Заявки загружены: 0
[instrument_BBG004731354]: Загружаю 31 свечей для ROSN ...
[instrument_BBG004731354]: Свечи загружены: 525, текущая цена: 409
[strategy_BBG004731354]: Сигналы: profit=wait, rsi=wait, sma=wait (29.04.2022, 18:49:00)
Операции:
     29.04.2022, 15:54:00 Покупка ЦБ BBG004731354 (1) -404.3 rub
     29.04.2022, 16:04:00 Продажа ЦБ BBG004731354 (1) 403.95 rub
     29.04.2022, 16:35:00 Покупка ЦБ BBG004731354 (1) -404.05 rub
     29.04.2022, 17:11:00 Продажа ЦБ BBG004731354 (1) 406.1 rub
     29.04.2022, 18:11:00 Покупка ЦБ BBG004731354 (1) -408.9 rub
Прибыль: -0.010868%
```
</details>

## Запуск на рыночных данных
Запуск робота на рыночных данных возможен в разных вариантах: по расписанию, либо в виде постоянного процесса.
На длинных таймфреймах (>1мин) лучше запускать по расписанию.

Запуск робота в песочнице:
```
npm run market
```

Запуск робота на реальном счете:
```
npm run market:real
```

Также доступны еще два флага:
* `--dry-run` - в этом случае производятся все действия кроме создания заявок (даже на боевом счете)
* `--cron` - разовый запуск, а не процесс

Пример: разовый запуск робота на реальном счете без создания заявок:
```
npm run market:real -- --dry-run --cron
```

## Статистика

## Визуализация

## Связанные проекты
* [tinkoff-invest-api](https://github.com/vitalets/tinkoff-invest-api) - Node.js клиент для работы с Tinkoff Invest API
* [tinkoff-local-broker](https://github.com/vitalets/tinkoff-local-broker) - Сервер для тестирования торговых роботов на Tinkoff Invest API
* [debut-js/Indicators](https://github.com/debut-js/Indicators) - Расчет индикаторов

## Лицензия
Apache 2.0
