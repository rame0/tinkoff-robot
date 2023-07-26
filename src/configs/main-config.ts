/**
 * Конфигурация.
 */
import { CandleInterval } from 'tinkoff-invest-api/dist/generated/marketdata.js';
import { RobotConfig } from '../robot.js';
import { StrategyTypes } from "../strategies/strategyTypes.js";

export const config: RobotConfig = {
  /** Используем реальный счет или песочницу */
  useRealAccount: true,
  /** Уровень логирования */
  logLevel: 'info',
  //logLevel: 'warn',
  /** Используемые стратегии: */
  strategies: [
    { // TGLD
      /** ID инструмента */
      figi: 'TCS10A101X50',
      /** По сколько лотов покупаем/продаем */
      orderLots: 100,
      /** Комиссия брокера, % от суммы сделки */
      brokerFee: 0.0,
      /** Интервал свечей */
      interval: CandleInterval.CANDLE_INTERVAL_1_MIN,
      strategyType: StrategyTypes.stupid,
      profit: {
        /** При каком % превышении цены продаем актив, чтобы зафиксировать прибыль */
        takeProfit: 1.5,
        /** При каком % снижении цены продаем актив, чтобы не потерять еще больше */
        stopLoss: 1.5,
      },
    },
    { // KLSB
      /** ID инструмента */
      figi: 'BBG000DBD6F6',
      /** По сколько лотов покупаем/продаем */
      orderLots: 1,
      /** Комиссия брокера, % от суммы сделки */
      brokerFee: 0.05,
      /** Интервал свечей */
      interval: CandleInterval.CANDLE_INTERVAL_1_MIN,
      strategyType: StrategyTypes.profitRsiSMMA,
      profit: { takeProfit: 0.2, stopLoss: 0.1 },
      sma: { fastLength: 12, slowLength: 24 },
      rsi: { period: 28, highLevel: 80, lowLevel: 20 }
    }
  ]
};
