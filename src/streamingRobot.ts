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
    let subscriptions = [];
    // загрузка состояния портфеля
    await this.portfolio.load();

    // подписка на портфель
    this.api.stream.portfolio.on('data', (response) => {
      if (response && response.portfolio) {
        this.portfolio.fromStream(response.portfolio);
      }
    });
    this.api.stream.portfolio.on('error', error => {
      this.logger.error('stream error: ', error.name, error.message);
    });
    this.api.stream.portfolio.on('close', error => {
      this.logger.error('stream closed, reason:', error.name, error.message);
      this.logger.warn("\n\n--- Перезапуск подписки на портфолио ---\n\n");
      this.startPortfolioWatch();
    });

    this.startPortfolioWatch();
    this.logger.warn('Подписались на портфолио');

    // обработка событий стрима рыночных данных
    this.api.stream.market.on('error', error => {
      this.logger.error('stream error', error.name, error.message);
    });
    this.api.stream.market.on('close', async error => {
      this.logger.error('stream closed, reason:', error.name, error.message);
      this.logger.warn("\n\n--- Перезапуск подписки на свечи ---\n\n");
      try {
        for (const subscription of subscriptions) {
          await subscription();
        }
      } catch (e) {
        //
      }
      subscriptions = await this.startMarketWatch();
    });

    // подписка на свечи
    subscriptions = await this.startMarketWatch();

    process.on('SIGINT', () => {
        this.logger.warn('Exiting...');
        subscriptions.forEach(async subscription => await subscription());
        this.isRunning = false;
        process.exit(0);
      }
    );

  }

  protected async runStrategies() {
    const tasks = this.strategies.map(strategy => strategy.run());
    await Promise.all(tasks);
  }

  protected async startMarketWatch() {
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
          candle.time.setMilliseconds(0);
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

    return subscriptions;
  }

  protected startPortfolioWatch() {
    this.api.stream.portfolio.watch({
      accounts: [this.account.accountId],
    });
  }
}
