/**
 * Конфигурация.
 */

import { RobotConfig } from '../robot.js';
import { StrategyConfig } from "../baseStrategy.js";
import { StrategyTypes } from "../strategies/strategyTypes.js";
import { CandleInterval, SubscriptionInterval } from "tinkoff-invest-api/cjs/generated/marketdata.js";

const basic = { // KLSB
  /** ID инструмента */
  figi: 'BBG000DBD6F6',
  /** По сколько лотов покупаем/продаем */
  orderLots: 1,
  /** Комиссия брокера, % от суммы сделки */
  brokerFee: 0.05,
  /** Интервал свечей */
  candleInterval: CandleInterval.CANDLE_INTERVAL_1_MIN,
  subscriptionInterval: SubscriptionInterval.SUBSCRIPTION_INTERVAL_ONE_MINUTE,
  strategyType: StrategyTypes.profitRsiSMMA,
  profit: {
    /** При каком % превышении цены продаем актив, чтобы зафиксировать прибыль */
    takeProfit: 1.5,
    /** При каком % снижении цены продаем актив, чтобы не потерять еще больше */
    stopLoss: 1.5,
  },

  sma: { fastLength: 6, slowLength: 12, },
  rsi: { period: 14, highLevel: 70, lowLevel: 30, },

  keepOrdersAlive: {
    sell: 0,
    buy: 0,
  }
};

function getStrategyConfig(figi: string, additional: {
  sma?: { fastLength: number, slowLength: number },
  profit?: { takeProfit: number, stopLoss: number }
  rsi?: { period: number, highLevel: number, lowLevel: number }
}, brokerFee = 0): StrategyConfig {
  const conf = { ...basic, ...additional };
  conf.brokerFee = brokerFee;
  conf.figi = figi;
  return conf;
}

export const config: RobotConfig = {
  /** Используем реальный счет или песочницу */
  useRealAccount: true,
  /** Уровень логирования */
  // logLevel: 'info',
  logLevel: 'warn',
  /** Используемые стратегии: */
  strategies: [
    getStrategyConfig('BBG000DBD6F6',
      {
        sma: { fastLength: 12, slowLength: 24 },
        rsi: { period: 14, highLevel: 70, lowLevel: 30 }
      }, 0.05),
    getStrategyConfig('BBG000DBD6F6',
      {
        sma: { fastLength: 12, slowLength: 24 },
        rsi: { period: 28, highLevel: 70, lowLevel: 30 }
      }, 0.05),
    getStrategyConfig('BBG000DBD6F6',
      {
        sma: { fastLength: 12, slowLength: 24 },
        rsi: { period: 14, highLevel: 80, lowLevel: 20 }
      }, 0.05),
    getStrategyConfig('BBG000DBD6F6',
      {
        sma: { fastLength: 12, slowLength: 24 },
        rsi: { period: 28, highLevel: 80, lowLevel: 20 }
      }, 0.05),

    getStrategyConfig('BBG000DBD6F6',
      {
        sma: { fastLength: 6, slowLength: 12 },
        rsi: { period: 28, highLevel: 70, lowLevel: 30 }
      }, 0.05),
    getStrategyConfig('BBG000DBD6F6',
      {
        sma: { fastLength: 6, slowLength: 12 },
        rsi: { period: 28, highLevel: 70, lowLevel: 30 }
      }, 0.05),
    getStrategyConfig('BBG000DBD6F6',
      {
        sma: { fastLength: 6, slowLength: 12 },
        rsi: { period: 28, highLevel: 80, lowLevel: 20 }
      }, 0.05),
    getStrategyConfig('BBG000DBD6F6',
      {
        sma: { fastLength: 6, slowLength: 12 },
        rsi: { period: 28, highLevel: 80, lowLevel: 20 }
      }, 0.05),

  ]
};
