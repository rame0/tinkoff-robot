/**
 * Входная точка для торгового робота.
 * Робот запускает параллельно несколько стратегий, переданных в конфиге.
 */
import {
  CandlesLoader,
  RealAccount,
  SandboxAccount,
  TinkoffAccount,
  TinkoffInvestApi
} from "tinkoff-invest-api";
import { Logger, LogLevel } from '@vitalets/logger';
import { BaseStrategy, StrategyConfig } from './baseStrategy.js';
import { Orders } from './account/orders.js';
import { Portfolio } from './account/portfolio.js';
import { ProfitRsiSMMAStrategy } from "./strategies/profitRsiSMMAStrategy.js";
import { StupidStrategy } from "./strategies/stupidStrategy.js";
import { StrategyTypes } from "./strategies/strategyTypes.js";
import { CandleInterval } from "tinkoff-invest-api/cjs/generated/marketdata.js";
import { randomStrategy } from "./strategies/randomStrategy";

const { REAL_ACCOUNT_ID = '', SANDBOX_ACCOUNT_ID = '' } = process.env;

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

const defaults: Pick<RobotConfig, 'dryRun' | 'cacheDir' | 'logLevel'> = {
  dryRun: false,
  cacheDir: '.cache',
  logLevel: 'info',
};

export class Robot {
  config: RobotConfig;
  account: TinkoffAccount;
  candlesLoader: CandlesLoader;
  orders: Orders;
  portfolio: Portfolio;
  strategies: BaseStrategy[];
  delay: number;

  logger: Logger;

  constructor(public api: TinkoffInvestApi, config: RobotConfig) {
    this.config = Object.assign({}, defaults, config);
    this.logger = new Logger({ prefix: '[robot]:', level: this.config.logLevel as LogLevel });
    this.account = config.useRealAccount
      ? new RealAccount(api, REAL_ACCOUNT_ID)
      : new SandboxAccount(api, SANDBOX_ACCOUNT_ID);
    this.candlesLoader = new CandlesLoader(api, { cacheDir: this.config.cacheDir });
    this.orders = new Orders(this);
    this.portfolio = new Portfolio(this);

    this.strategies = this.config.strategies.map(sc => {
      switch (sc.strategyType) {
        case StrategyTypes.profitRsiSMMA:
          return new ProfitRsiSMMAStrategy(this, sc);
        case StrategyTypes.stupid:
          return new StupidStrategy(this, sc);
        case StrategyTypes.random:
          return new randomStrategy(this, sc);
        default:
          throw new Error(`Unknown strategy type: ${sc.strategyType}`);
      }
    });

    this.delay = this.intervalToMs(config.strategies[ 0 ].candleInterval);

  }

  /**
   * Разовый запуск робота на текущих данных.
   * Подходит для запуска по расписанию.
   */
  async run(once = false) {
    if (once) {
      await this.runOnce();
    } else {
      while (true) {
        await this.runOnce();
        await this.sleep(this.delay);
        // await this.sleep(1000 * 50);
      }
    }
  }

  async runOnce() {
    this.logger.log(`Вызов робота (${this.config.useRealAccount ? 'боевой счет' : 'песочница'})`);
    await this.portfolio.load();
    await this.orders.load();
    await this.runStrategies();
    this.logger.log(`Вызов робота завершен`);
  }

  async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  intervalToMs(interval: CandleInterval) {
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

  // todo: Запуск робота в режиме стрима.
  // async runStream(intervalMinutes = 1) {
  // - take figi from strategies
  // - load candles for all figi
  // - watch prices for all figi
  // }

  protected async runStrategies() {
    const tasks = this.strategies.map(strategy => strategy.run());
    await Promise.all(tasks);
  }
}
