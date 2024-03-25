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
import { LimitOrderReq } from "../account/orders";
import { OrderDirection } from "tinkoff-invest-api/cjs/generated/orders.js";

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
    // if (options.availableLots > 0 && (signals.random == 'buy')) {
    //   return null;
    // } else {
    return signals.random;
    // }

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

  /**
   * Покупка.
   */
  protected async buy() {
    if (!await this.checkCancelBuyOrders()) {
      return;
    }

    const currentPrice = this.instrument.getCurrentPrice();
    const orderReq: LimitOrderReq = {
      figi: this.config.figi,
      direction: OrderDirection.ORDER_DIRECTION_BUY,
      quantity: this.config.orderLots,
      price: this.api.helpers.toQuotation(this.instrument.getCurrentPrice()),
    };

    if (this.checkEnoughCurrency(orderReq)) {
      this.logger.warn(`Покупаем по цене ${currentPrice}.`);
      await this.robot.orders.postLimitOrder(orderReq);
    }
  }

  /**
   * Продажа.
   */
  protected async sell() {
    if (!await this.checkCancelSellOrders()) {
      return;
    }

    const currentPrice = this.instrument.getCurrentPrice();

    const orderReq: LimitOrderReq = {
      figi: this.config.figi,
      direction: OrderDirection.ORDER_DIRECTION_SELL,
      quantity: this.config.orderLots, // продаем все, что есть
      price: this.api.helpers.toQuotation(currentPrice),
    };

    const buyPrice = this.robot.portfolio.getBuyPrice(this.config.figi);
    const commission = (buyPrice + currentPrice) * this.config.brokerFee / 100;
    const profit = currentPrice - buyPrice - commission;
    this.totalProfit += profit * this.config.orderLots;

    this.logger.warn([
      `Продаем по цене ${currentPrice}.`,
      `Расчетная маржа: ${this.currentProfit > 0 ? '+' : ''}${this.currentProfit.toFixed(2)}%`
    ].join(' '));

    await this.robot.orders.postLimitOrder(orderReq);
  }

  protected async checkCancelBuyOrders() {
    return true;
  }
}
