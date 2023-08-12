/**
 * Входная точка для торгового робота.
 * Робот запускает параллельно несколько стратегий, переданных в конфиге.
 */
import { CandlesLoader, TinkoffAccount, TinkoffInvestApi } from 'tinkoff-invest-api';
import { Logger } from '@vitalets/logger';
import { BaseStrategy, StrategyConfig } from './baseStrategy.js';
import { Orders } from './account/orders.js';
import { Portfolio } from './account/portfolio.js';
import { Robot } from "./robot.js";
import { Candle, SubscriptionInterval } from "tinkoff-invest-api/cjs/generated/marketdata.js";

export interface RobotConfig {
  /** Используем реальный счет или песочницу */
  useRealAccount: boolean,
  /** Запуск без создания заявок */
  dryRun?: boolean;
  /** Директория для кеширования свечей */
  cacheDir?: string,
  /** Уровень логирования */
  logLevel?: string,
  /** Используемые стратегии */
  strategies: StrategyConfig[],
}

export class streamingRobot extends Robot {
  config: RobotConfig;
  account: TinkoffAccount;
  candlesLoader: CandlesLoader;
  orders: Orders;
  portfolio: Portfolio;
  strategies: BaseStrategy[];

  lastMinute = 0;
  logger: Logger;

  isRunning = true;

  constructor(public api: TinkoffInvestApi, config: RobotConfig) {
    super(api, config);
  }

  public async run() {
    // обработка дополнительных событий
    this.api.stream.market.on('error', error => this.logger.error('stream error', error));
    this.api.stream.market.on('close', error => this.logger.error('stream closed, reason:', error));

    const subscriptions = [];
    for (const strategy of this.strategies) {
      this.logger.info(`Подписались на свечи ${strategy.config.figi}...`);
      strategy.delay = this.intervalToMs(strategy.config.candleInterval);
      subscriptions.push(await this.api.stream.market.candles({
          instruments: [
            {
              figi: strategy.instrument.figi,
              instrumentId: strategy.instrument.figi,
              interval: strategy.config.subscriptionInterval || SubscriptionInterval.SUBSCRIPTION_INTERVAL_ONE_MINUTE,
            }
          ],
          waitingClose: false,
        }, (candle: Candle) => {
          candle.time.setSeconds(0, 0);
          if (strategy.lastTime.getTime() + strategy.delay > candle.time.getTime()) {
            return;
          }
          strategy.lastTime = candle.time;
          strategy.run({
            open: candle.open,
            close: candle.close,
            high: candle.high,
            low: candle.low,
            time: candle.time,
            volume: candle.volume,
            isComplete: true,
          });
        }
      ));
    }

    process.on('SIGINT', () => {
        this.logger.warn('Exiting...');
        subscriptions.forEach(async subscription => await subscription());
        this.isRunning = false;
        process.exit(0);
      }
    );

    while (true) {
      if (!this.isRunning) {
        break;
      }
      await this.portfolio.load();
      await this.sleep(1000 * 50);
    }
  }

  protected async runStrategies() {
    const tasks = this.strategies.map(strategy => strategy.run());
    await Promise.all(tasks);
  }
}
