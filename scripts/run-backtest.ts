/**
 * Бэктест стратегии на исторических свечах:
 * npx ts-node-esm scripts/run-backtest.ts
 * DEBUG=tinkoff-invest-api:* npx ts-node-esm scripts/run-backtest.ts
 *
 * Предварительно нужно запустить сервер tinkoff-local-broker.
 */
// import fs from 'fs';
import MockDate from 'mockdate';
import {Helpers} from 'tinkoff-invest-api';
import {Robot} from '../src/robot.js';
import {config} from '../src/config-klsb.js';
import {OperationState, OperationType} from 'tinkoff-invest-api/dist/generated/operations.js';
import {backtestApi as api} from './init-api.js';
import {StrategyConfig} from "../src/baseStrategy";
import {CandleInterval} from "tinkoff-invest-api/dist/generated/marketdata.js";

let start_n = 0;
if (process.argv[2]) {
  start_n = Number(process.argv[2]);
}

let strategyType = 0;
if (process.argv[3]) {
  strategyType = Number(process.argv[3]);
}

let interval: CandleInterval = CandleInterval.UNRECOGNIZED;
switch (Number(process.argv[4])) {
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
}

if (interval == CandleInterval.UNRECOGNIZED) {
  console.log('interval not set');
  process.exit();
} else {
  console.log(`interval: ${interval.toString()}`);
}

// Диапазон дат для бэктеста
const from = new Date('2023-06-24T00:00:00+03:00');
const to = new Date('2023-07-24T23:59:00+03:00');

// Для бэктеста оставляем тестируем по одной стратегии за раз
const strategies = config.strategies;

config.strategies = strategies.slice(start_n, start_n + 1);
console.log(config.strategies);
if (config.strategies.length < 1)
  process.exit();

const strategyConfig = config.strategies[0];
strategyConfig.interval = interval;

console.log(`strategyType: ${strategyType}`);

void main(strategyConfig);

async function main(strategyConfig: StrategyConfig) {
  await configureBroker({from, to, candleInterval: strategyConfig.interval});

  const robot = new Robot(api, {...config, logLevel: 'none', strategyType: strategyType,});

  while (await tick()) {
    await robot.runOnce();
  }

  // await showOperations(strategyConfig);
  await countOperations(strategyConfig);
  await showExpectedYield();
  robot.strategies.map(s => console.log(`Profit from strategy run: ${s.totalProfit}`));
  // buildCharts(robot);
}

async function showExpectedYield() {
  const {expectedYield} = await api.operations.getPortfolio({accountId: ''});
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
  const {operations} = await api.operations.getOperations({
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

//
// function buildCharts(robot: Robot) {
//   const strategy = robot.strategies[0];
//   const charts = strategy.smaSignal?.charts;
//   if (!charts) return;
//
//   const series = Object.keys(charts).map(name => ({name, data: charts[name].map(val => [(val[0].getTime()), val[1]])}));
//   // const series = Object.keys(charts).map(name => ({name, data: charts[name]}));
//   const seriesContent = JSON.stringify(series);
//   const tpl = fs.readFileSync('chart/index.tpl.js', 'utf8');
//   const newContent = tpl
//     .replace('%ticker%', strategy.instrument.info?.ticker || strategy.config.figi)
//     .replace('series: []', `series: ${seriesContent}`);
//   fs.writeFileSync('chart/index.js', newContent);
// }
