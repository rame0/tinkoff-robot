/**
 * Запуск робота на рыночных данных.
 *
 * В песочнице (по умолчанию):
 * npx ts-node-esm scripts/run-market.ts
 *
 * На реальном счете (без создания заявок):
 * npx ts-node-esm scripts/run-market.ts --real --dry-run
 *
 * На реальном счете (с созданием заявок):
 * npx ts-node-esm scripts/run-market.ts --real
 *
 * Для разового запуска по расписанию можно указать флаг cron:
 * npx ts-node-esm scripts/run-market.ts --real --dry-run --cron
 */
import { api } from './init-api.js';
import { Robot } from '../src/robot.js';
import { config } from '../src/config.js';
import { CandleInterval } from 'tinkoff-invest-api/dist/generated/marketdata.js';
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

interface Arguments extends yargs.Arguments {
  real: boolean;
  dry_run: boolean;
  cron: boolean;
  config: string;
}

const args: Arguments = yargs(hideBin(process.argv))
  .option('real', {
    global: true,
    alias: 'r',
    type: 'boolean',
    description: 'Запуск на реальном счете',
    default: false,
  })
  .option('dry_run', {
    global: true,
    alias: 'd',
    type: 'boolean',
    description: 'Запуск без создания заявок',
    default: false,
  })
  .option('cron', {
    global: true,
    type: 'boolean',
    description: 'Запуск по расписанию',
    default: false,
  })
  .option('config', {
    global: true,
    alias: 'c',
    type: 'string',
    description: 'Имя файла конфигурации из папки src/configs',
    default: 'main-config',
  })
  .help()
  .parse() as Arguments;

const delay = intervalToMs((await config(args.config)).strategies[ 0 ].interval);

main();

async function main() {
  const finalConfig = { ...await config(args.config), ...args };
  const robot = new Robot(api, finalConfig);
  if (args.cron) {
    await robot.runOnce();
    return;
  }
  while (true) {
    await robot.runOnce();
    await sleep(delay);
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function intervalToMs(interval: CandleInterval) {
  switch (interval) {
    case CandleInterval.CANDLE_INTERVAL_1_MIN:
      return 60 * 1000;
    case CandleInterval.CANDLE_INTERVAL_5_MIN:
      return 5 * 60 * 1000;
    case CandleInterval.CANDLE_INTERVAL_15_MIN:
      return 15 * 60 * 1000;
    case CandleInterval.CANDLE_INTERVAL_HOUR:
      return 60 * 60 * 1000;
    case CandleInterval.CANDLE_INTERVAL_DAY:
      return 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Invalid interval`);
  }
}
