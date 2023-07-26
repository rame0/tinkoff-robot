/**
 * Сигнал profit-loss.
 * При сильном отклонении текущей цены от начальной происходит продажа актива (takeProfit / stopLoss)
 */

import { Signal, SignalParams, SignalResult } from './base.js';
import { RobotModule } from "../utils/robot-module";

const defaultConfig = {
  /** При каком % превышении цены продаем актив, чтобы зафиксировать прибыль */
  takeProfit: 15,
  /** При каком % снижении цены продаем актив, чтобы не потерять еще больше */
  stopLoss: 5,
};

export type ProfitLossSignalConfig = typeof defaultConfig;

export class BuyLowSellHigh extends Signal<ProfitLossSignalConfig> {
  constructor(protected strategy: RobotModule) {
    super(strategy, Object.assign({}, defaultConfig));
  }

  get minCandlesCount() {
    return 1;
  }

  calc({ candles, profit }: SignalParams, { buyPrice, brokerFee, availableLots }): SignalResult {
    const closePrices = this.getPrices(candles, 'close').at(-2);
    const currentPrice = this.getPrices(candles, 'close').at(-1);
    if (profit >= 0) {
      this.logger.warn(`Цена повысилась более чем на ${profit}%`);
    }
    if (availableLots > 0 && currentPrice >= buyPrice + brokerFee) {
      this.logger.warn(`Цена повысилась продаем`);
      return 'sell';
    }
    if (currentPrice <= closePrices - brokerFee) {
      this.logger.warn(`Цена понизилась покупаем`);
      return 'buy';
    }

  }
}
