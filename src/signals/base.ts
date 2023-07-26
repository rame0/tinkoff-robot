/**
 * Базовый класс для сигналов рынка.
 */
import {Logger} from '@vitalets/logger';
import {Helpers} from 'tinkoff-invest-api';
import {HistoricCandle} from 'tinkoff-invest-api/dist/generated/marketdata.js';
import {RobotModule} from "../utils/robot-module";

export type SignalResult = 'buy' | 'sell' | void;

export interface SignalParams {
  candles: HistoricCandle[],
  profit: number;
}

export abstract class Signal<T> {
  logger: Logger;
  charts: Record<string, [Date, number][]> = {};

  protected constructor(protected strategy: RobotModule, protected config: T) {
    this.logger = strategy.logger.withPrefix(`[${this.constructor.name}]:`);
  }

  abstract get minCandlesCount(): number;

  // abstract calc(req: SignalParams): SignalResult;
  abstract calc(req: SignalParams, opts?: object): SignalResult;

  protected getPrices(candles: HistoricCandle[], type: 'close' | 'open' | 'low' | 'high') {
    return candles.map(candle => Helpers.toNumber(candle[type]!));
  }

  /**
   * Сохранение значений для отрисовки
   */
  protected plot(label: string, values: number[], candles: HistoricCandle[]) {
    const lastCandle = candles.slice(-1)[0];
    const lastValue = values.slice(-1)[0];
    if (lastCandle) {
      const time = lastCandle.time!;
      const chart = this.charts[label] || [];
      chart.push([time, lastValue]);
      this.charts[label] = chart;
    }
  }
}
