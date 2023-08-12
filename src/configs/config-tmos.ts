/**
 * Конфигурация.
 */
import { CandleInterval } from "tinkoff-invest-api/cjs/generated/marketdata.js";
import { RobotConfig } from '../robot.js';
import { StrategyTypes } from "../strategies/strategyTypes.js";

export const config: RobotConfig = {
  /** Используем реальный счет или песочницу */
  useRealAccount: true,
  /** Уровень логирования */
  // logLevel: 'info',
  logLevel: 'warn',
  /** Используемые стратегии: */
  strategies: [
    {
      strategyType: StrategyTypes.stupid,
      /** ID инструмента */
      figi: 'BBG333333333',
      /** По сколько лотов покупаем/продаем */
      orderLots: 500,
      /** Комиссия брокера, % от суммы сделки */
      brokerFee: 0.0,
      /** Интервал свечей */
      candleInterval: CandleInterval.CANDLE_INTERVAL_1_MIN,
      keepOrdersAlive: {
        sell: 15,
        buy: 5
      }
    }
  ]
};

