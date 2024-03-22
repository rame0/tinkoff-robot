/**
 * Конфигурация.
 */
import { CandleInterval, SubscriptionInterval } from "tinkoff-invest-api/cjs/generated/marketdata.js";
import { RobotConfig } from '../robot.js';
import { StrategyTypes } from "../strategies/strategyTypes.js";

export const config: RobotConfig = {
  /** Используем реальный счет или песочницу */
  useRealAccount: true,
  /** Уровень логирования */
  logLevel: 'info',
  // logLevel: 'warn',
  /** Используемые стратегии: */
  strategies: [
    { // TCS Group
      /** ID инструмента */
      figi: 'TCS10A101X50',
      /** По сколько лотов покупаем/продаем */
      orderLots: 1,
      /** Комиссия брокера, % от суммы сделки */
      brokerFee: 0.0,
      /** Интервал свечей */
      candleInterval: CandleInterval.CANDLE_INTERVAL_1_MIN,
      subscriptionInterval: SubscriptionInterval.SUBSCRIPTION_INTERVAL_ONE_MINUTE,
      strategyType: StrategyTypes.random,

      keepOrdersAlive: {
        sell: 2,
        buy: 2
      }
    }
  ]
};
