/**
 * Конфигурация.
 */
import { CandleInterval } from 'tinkoff-invest-api/dist/generated/marketdata.js';
import { RobotConfig } from './robot.js';
import { StrategyConfig } from './strategy.js';

export const config: RobotConfig = {
  /** Используем реальный счет или песочницу */
  useRealAccount: true,
  /** Уровень логирования */
  //logLevel: 'info',
  logLevel: 'warn',
  /** Используемые стратегии: */
  strategies: [
//    getStrategyConfig('BBG004731354'), // Роснефть
//    getStrategyConfig('BBG008F2T3T2'), // РУСАЛ
//    getStrategyConfig('BBG004S68829'), // Татнефть
//    getStrategyConfig('BBG000BN56Q9'), // Детский Мир
//    getStrategyConfig('BBG004730N88'), // Сбер
//     getStrategyConfig('TCS00A1039N1'), // TBRU
    getStrategyConfig('BBG333333333'), // TMOS
    getStrategyConfig('BBG000000001'), // TRUR
    getStrategyConfigMVID('BBG004S68CP5'), // MVID
    // getStrategyConfig('BBG00V7649K4'), // AKMB
    // getStrategyConfig('TCS00A102YC6'), // Тинькофф SPAC
  ]
};

function getStrategyConfig(figi: string): StrategyConfig {
  return {
    /** ID инструмента */
    figi,
    /** По сколько лотов покупаем/продаем */
    orderLots: 1,
    /** Комиссия брокера, % от суммы сделки */
    brokerFee: 0.0,
    /** Интервал свечей */
    interval: CandleInterval.CANDLE_INTERVAL_1_MIN,
    /** Конфиг сигнала по отклонению текущей цены */
    profit: {
      /** При каком % превышении цены продаем актив, чтобы зафиксировать прибыль */
      takeProfit: 0.5,
      /** При каком % снижении цены продаем актив, чтобы не потерять еще больше */
      stopLoss: 0.5,
    },
    /** Конфиг сигнала по скользящим средним */
    sma: {
      /** Кол-во точек для расчета быстрого тренда */
      fastLength: 50,
      /** Кол-во точек для расчета медленного тренда */
      slowLength: 200,
    },
    /** Конфиг сигнала по RSI */
    rsi: {
      /** Кол-во точек для расчета rsi */
      period: 14,
      /** Верхний уровень */
      highLevel: 70,
      /** Нижний уровень */
      lowLevel: 30,
    }
  };
}
function getStrategyConfigMVID(figi: string): StrategyConfig {
  return {
    /** ID инструмента */
    figi,
    /** По сколько лотов покупаем/продаем */
    orderLots: 1,
    /** Комиссия брокера, % от суммы сделки */
    brokerFee: 0.05,
    /** Интервал свечей */
    interval: CandleInterval.CANDLE_INTERVAL_1_MIN,
    /** Конфиг сигнала по отклонению текущей цены */
    profit: {
      /** При каком % превышении цены продаем актив, чтобы зафиксировать прибыль */
      takeProfit: 1,
      /** При каком % снижении цены продаем актив, чтобы не потерять еще больше */
      stopLoss: 1,
    },
    /** Конфиг сигнала по скользящим средним */
    sma: {
      /** Кол-во точек для расчета быстрого тренда */
      fastLength: 50,
      /** Кол-во точек для расчета медленного тренда */
      slowLength: 200,
    },
    /** Конфиг сигнала по RSI */
    rsi: {
      /** Кол-во точек для расчета rsi */
      period: 14,
      /** Верхний уровень */
      highLevel: 70,
      /** Нижний уровень */
      lowLevel: 30,
    }
  };
}
