/**
 * Бэктест стратегии на исторических свечах:
 * npx ts-node-esm scripts/run-backtest.ts
 * DEBUG=tinkoff-invest-api:* npx ts-node-esm scripts/run-backtest.ts
 *
 * Предварительно нужно запустить сервер tinkoff-local-broker.
 */
// import fs from 'fs';
import MockDate from 'mockdate';
import { Helpers } from 'tinkoff-invest-api';
import { Robot } from '../src/robot.js';
import { OperationState, OperationType } from 'tinkoff-invest-api/dist/generated/operations.js';
import { backtestApi as api } from './init-api.js';
import { StrategyConfig } from "../src/baseStrategy";
import { CandleInterval } from "tinkoff-invest-api/dist/generated/marketdata.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { logger } from "yandex-cloud-deploy-fn/dist/helpers/logger";

interface Arguments extends yargs.Arguments {
  start_n: number;
  interval: number;
  config: string;
  streaming: boolean;
  start: string;
  end: string;
}

const args: Arguments = yargs(hideBin(process.argv))
  .option('start_n', {
    global: true,
    alias: 's',
    type: 'number',
    description: 'Номер стратегии из конфига, которую будем тестировать',
    default: 0,
  })
  .option('interval', {
    global: true,
    alias: 'i',
    type: 'number',
    description: 'Интервал свечей для текущего теста (1 - 1мин., 2 - 5мин., 3 - 15мин., 4 - 1час). Он заменит ' +
      'интервал указанный в файле конфигурации',
    default: 1,
  })
  .option('streaming', {
    global: true,
    type: 'boolean',
    description: 'Запуск стримингового робота',
    default: false,
  })
  .option('config', {
    global: true,
    alias: 'c',
    type: 'string',
    description: 'Имя файла конфигурации из папки src/configs',
  })
  .option('start', {
    global: true,
    alias: 'f',
    type: 'string',
    description: 'Начало периода бэктеста (формат: ГГГГ/ММ/ДД)',
  })
  .option('end', {
    global: true,
    alias: 'e',
    type: 'string',
    description: 'Конец периода бэктеста (формат: ГГГГ/ММ/ДД)',
  })
  .help()
  .parse() as Arguments;

let interval: CandleInterval = CandleInterval.UNRECOGNIZED;
switch (args.interval) {
  case 1:
    interval = CandleInterval.CANDLE_INTERVAL_1_MIN;
    break;
  case 2:
    interval = CandleInterval.CANDLE_INTERVAL_5_MIN;
    break;
  case 3:
    interval = CandleInterval.CANDLE_INTERVAL_15_MIN;
    break;
  case 4:
    interval = CandleInterval.CANDLE_INTERVAL_HOUR;
    break;
  default:
    console.log('interval not set');
    process.exit();
}

console.log(`interval: ${interval.toString()}`);

// Диапазон дат для бэктеста
const from = new Date(`${args.start}T00:00:00+03:00`);
const to = new Date(`${args.end}T23:59:00+03:00`);

// Для бэктеста оставляем тестируем по одной стратегии за раз
const module = await import(`../src/configs/${args.config}.js`);
const config = module.config;

if (!config.strategies || config.strategies.length < 1) {
  console.log('No strategies in config');
  process.exit();
}
if (config.strategies[ args.start_n ] === undefined) {
  console.log('No strategy with this number');
  process.exit();
}

const strategyConfig = config.strategies[ args.start_n ];
strategyConfig.candleInterval = interval;
config.strategies = [ strategyConfig ];

void main(strategyConfig);

async function main(strategyConfig: StrategyConfig) {
  await configureBroker({ from, to, candleInterval: strategyConfig.candleInterval });
  const robot = new Robot(api, { ...config, logLevel: 'none' });

  try {
    while (await tick()) {
      await robot.run(true);
    }
  } catch (e) {
    robot.logger.error(e.details || e.message);
  }

  // await showOperations(strategyConfig);
  await countOperations(strategyConfig);
  await showExpectedYield();
  robot.strategies.map(s => console.log(`Profit from strategy run: ${s.totalProfit}`));
  buildCharts(robot);
}

async function showExpectedYield() {
  const { expectedYield } = await api.operations.getPortfolio({ accountId: '', currency: 0 });
  console.log(`Прибыль: ${Helpers.toNumber(expectedYield)}%`);
}

// async function showOperations(strategyConfig: StrategyConfig) {
//   console.log(`Операции:`);
//   const {operations} = await api.operations.getOperations({
//     figi: strategyConfig.figi,
//     state: OperationState.OPERATION_STATE_EXECUTED,
//     accountId: ''
//   });
//   operations
//     .filter(o => o.operationType !== OperationType.OPERATION_TYPE_BROKER_FEE)
//     .forEach(o => {
//       const s = [
//         ' '.repeat(4),
//         o.date?.toLocaleString(),
//         o.type,
//         o.figi,
//         o.quantity > 0 && `(${o.quantity})`,
//         `${api.helpers.toNumber(o.payment)} ${o.payment?.currency}`,
//       ].filter(Boolean).join(' ');
//       console.log(s);
//     });
// }

async function countOperations(strategyConfig: StrategyConfig) {
  const { operations } = await api.operations.getOperations({
    figi: strategyConfig.figi,
    state: OperationState.OPERATION_STATE_EXECUTED,
    accountId: ''
  });
  const count = operations.filter(o => o.operationType !== OperationType.OPERATION_TYPE_BROKER_FEE).length;

  console.log(`Операции: ${count}`);
}

async function configureBroker(config: unknown) {
  await api.orders.postOrder({
    accountId: 'config',
    figi: JSON.stringify(config),
    instrumentId: JSON.stringify(config),
    quantity: 0,
    direction: 0,
    orderType: 0,
    orderId: '',
  });
}

async function tick() {
  const res = await api.orders.postOrder({
    accountId: 'tick',
    figi: '',
    instrumentId: '',
    quantity: 0,
    direction: 0,
    orderType: 0,
    orderId: '',
  });
  if (res.message) {
    MockDate.set(new Date(res.message));
    return true;
  } else {
    return false;
  }
}

function buildCharts(robot: Robot) {
  // const strategy = robot.strategies[ 0 ];
  // const charts = strategy.smaSignal?.charts;
  // if (!charts) return;
  //
  // const series = Object.keys(charts).map(name => ({
  //   name,
  //   data: charts[ name ].map(val => [(val[ 0 ].getTime()), val[ 1 ]])
  // }));
  // // const series = Object.keys(charts).map(name => ({name, data: charts[name]}));
  // const seriesContent = JSON.stringify(series);
  // const tpl = fs.readFileSync('chart/index.tpl.js', 'utf8');
  // const newContent = tpl
  //   .replace('%ticker%', strategy.instrument.info?.ticker || strategy.config.figi)
  //   .replace('series: []', `series: ${seriesContent}`);
  // fs.writeFileSync('chart/index.js', newContent);
}
