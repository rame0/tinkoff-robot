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
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { streamingRobot } from "../src/streamingRobot.js";

interface Arguments extends yargs.Arguments {
  real: boolean;
  dry_run: boolean;
  cron: boolean;
  config: string;
  streaming: boolean;
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
    conflicts: 'streaming',
  })
  .option('streaming', {
    global: true,
    type: 'boolean',
    description: 'Запуск стримингового робота',
    conflicts: 'cron',
  })
  .option('config', {
    global: true,
    alias: 'c',
    type: 'string',
    description: 'Имя файла конфигурации из папки src/configs',
  })
  .help()
  .parse() as Arguments;

main();

async function main() {
  const finalConfig = { ...await config(args.config, args.streaming), ...args };

  if (args.streaming) {
    console.log('Running streaming robot');
    const robot = new streamingRobot(api, finalConfig);
    await robot.run();
  } else {
    console.log('Running unary robot');
    const robot = new Robot(api, finalConfig);
    await robot.run(args.cron);
  }

}
