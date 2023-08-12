/**
 * Стратегия торговли.
 * Используются 3 сигнала:
 * - при сильном отклонении текущей цены от начальной происходит продажа актива (takeProfit / stopLoss)
 * - пересечение скользящих средних
 * - пересечение RSI заданных уровней
 *
 * Особенности:
 * - все заявки выставляются только лимитные
 * - если актив уже куплен, то повторной покупки не происходит
 */

/* eslint-disable max-statements */

import { Robot } from '../robot.js';
import { FigiInstrument } from '../figi.js';
import { Logger } from '@vitalets/logger';
import { BaseStrategy, StrategyConfig } from "../baseStrategy.js";
import { BuyLowSellHigh } from "../signals/buy-low-sell-high.js";
import { ProfitLossSignal } from "../signals/profit-loss.js";

export class StupidStrategy extends BaseStrategy {
  instrument: FigiInstrument;
  currentProfit = 0;

  // используемые сигналы
  profitSignal?: ProfitLossSignal;
  buySell?: BuyLowSellHigh;

  constructor(robot: Robot, public config: StrategyConfig) {
    super(robot, config);
    this.logger = new Logger({ prefix: `[stupid_${config.figi}]:`, level: robot.logger.level });
    this.buySell = new BuyLowSellHigh(this);
    if (config.profit) this.profitSignal = new ProfitLossSignal(this, config.profit);
  }

  /**
   * Расчет сигнала к покупке или продаже.
   * todo: здесь может быть более сложная логика комбинации нескольких сигналов.
   */
  protected calcSignal() {
    const signalParams = { candles: this.instrument.candles, profit: this.currentProfit };
    const price = this.robot.portfolio.getBuyPrice(this.config.figi);
    const options = {
      buyPrice: price,
      brokerFee: price * this.config.brokerFee / 100,
      availableLots: this.calcAvailableLots()
    };
    const signals = {
      bySell: this.buySell.calc(signalParams, options),
      profitLoss: this.profitSignal?.calc(signalParams),
    };
    this.logSignals(signals);
    // todo: здесь может быть более сложная логика комбинации сигналов.
    return signals.bySell || signals.profitLoss;
  }

  /**
   * Расчет необходимого кол-ва свечей, чтобы хватило всем сигналам.
   */
  protected calcRequiredCandlesCount() {
    const minCounts = [
      this.profitSignal?.minCandlesCount || 1,
      this.buySell?.minCandlesCount || 1,
    ];
    return Math.max(...minCounts);

  }
}
