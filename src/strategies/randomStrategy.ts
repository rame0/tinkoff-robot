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
import { RandomSignal } from "../signals/randomSignal";

export class randomStrategy extends BaseStrategy {
  instrument: FigiInstrument;
  currentProfit = 0;

  // используемые сигналы
  // profitSignal?: ProfitLossSignal;
  randomSignal?: RandomSignal;

  constructor(robot: Robot, public config: StrategyConfig) {
    super(robot, config);
    this.logger = new Logger({ prefix: `[random_${config.figi}]:`, level: robot.logger.level });
    this.randomSignal = new RandomSignal(this);
  }

  /**
   * Расчет сигнала к покупке или продаже.
   * todo: здесь может быть более сложная логика комбинации нескольких сигналов.
   */
  protected calcSignal() {
    const price = this.robot.portfolio.getBuyPrice(this.config.figi);
    const options = {
      buyPrice: price,
      brokerFee: price * this.config.brokerFee / 100,
      availableLots: this.calcAvailableLots()
    };
    const signals = {
      random: this.randomSignal.calc(),
    };
    this.logSignals(signals);
    // todo: здесь может быть более сложная логика комбинации сигналов.
    if (options.availableLots > 0 && (signals.random == 'buy')) {
      return null;
    } else {
      return signals.random;
    }

  }

  /**
   * Расчет необходимого кол-ва свечей, чтобы хватило всем сигналам.
   */
  protected calcRequiredCandlesCount() {
    const minCounts = [
      this.randomSignal?.minCandlesCount || 1,
    ];
    return Math.max(...minCounts);

  }
}
