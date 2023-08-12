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
import { ProfitLossSignal } from '../signals/profit-loss.js';
import { SmaCrossoverSignal } from '../signals/sma-corssover.js';
import { FigiInstrument } from '../figi.js';
import { RsiCrossoverSignal } from '../signals/rsi-crossover.js';
import { Logger } from '@vitalets/logger';
import { BaseStrategy, StrategyConfig } from "../baseStrategy.js";

export class ProfitRsiSMMAStrategy extends BaseStrategy {
  instrument: FigiInstrument;
  currentProfit = 0;

  // используемые сигналы
  profitSignal?: ProfitLossSignal;
  smaSignal?: SmaCrossoverSignal;
  rsiSignal?: RsiCrossoverSignal;

  constructor(robot: Robot, public config: StrategyConfig) {
    super(robot, config);
    this.logger = new Logger({ prefix: `[profit_rsi_smma_${config.figi}]:`, level: robot.logger.level });
    if (config.profit) this.profitSignal = new ProfitLossSignal(this, config.profit);
    if (config.sma) this.smaSignal = new SmaCrossoverSignal(this, config.sma);
    if (config.rsi) this.rsiSignal = new RsiCrossoverSignal(this, config.rsi);
  }

  /**
   * Расчет сигнала к покупке или продаже.
   * todo: здесь может быть более сложная логика комбинации нескольких сигналов.
   */
  protected calcSignal() {
    const signalParams = { candles: this.instrument.candles, profit: this.currentProfit };
    const signals = {
      profit: this.profitSignal?.calc(signalParams),
      rsi: this.rsiSignal?.calc(signalParams),
      sma: this.smaSignal?.calc(signalParams),
    };
    this.logSignals(signals);
    // todo: здесь может быть более сложная логика комбинации сигналов.
    return signals.profit || signals.rsi || signals.sma;
  }

  /**
   * Расчет необходимого кол-ва свечей, чтобы хватило всем сигналам.
   */
  protected calcRequiredCandlesCount() {
    const minCounts = [
      this.profitSignal?.minCandlesCount || 1,
      this.smaSignal?.minCandlesCount || 1,
      this.rsiSignal?.minCandlesCount || 1,
    ];
    return Math.max(...minCounts);
  }
}
