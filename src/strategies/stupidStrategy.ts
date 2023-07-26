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

import {Robot} from '../robot.js';
import {FigiInstrument} from '../figi.js';
import {Logger} from '@vitalets/logger';
import {BaseStrategy, StrategyConfig} from "../baseStrategy.js";
import {BuyLowSellHigh} from "../signals/buy-low-sell-high.js";
import {OrderDirection, OrderState} from "tinkoff-invest-api/dist/generated/orders.js";
import {ProfitLossSignal} from "../signals/profit-loss";

export class StupidStrategy extends BaseStrategy {
  instrument: FigiInstrument;
  currentProfit = 0;
  failsCounter = {'buy': 0, 'sell': 0};

  // используемые сигналы
  profitSignal?: ProfitLossSignal;
  buySell?: BuyLowSellHigh;

  constructor(robot: Robot, public config: StrategyConfig) {
    super(robot, config);
    this.logger = new Logger({prefix: `[stupid_${config.figi}]:`, level: robot.logger.level});
    this.buySell = new BuyLowSellHigh(this);
    // if (config.profit) this.profitSignal = new ProfitLossSignal(this, config.profit);
  }

  /**
   * Расчет сигнала к покупке или продаже.
   * todo: здесь может быть более сложная логика комбинации нескольких сигналов.
   */
  protected calcSignal() {
    const signalParams = {candles: this.instrument.candles, profit: this.currentProfit};
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
    return signals.bySell;
  }

  /**
   * Расчет необходимого кол-ва свечей, чтобы хватило всем сигналам.
   */
  protected calcRequiredCandlesCount() {
    return this.buySell?.minCandlesCount || 1;
  }

  /**
   * Входная точка: запуск стратегии.
   */
  async run() {
    await this.instrument.loadInfo();
    if (!this.instrument.isTradingAvailable()) return;
    await this.loadCandles();
    this.calcCurrentProfit();
    const signal = this.calcSignal();
    if (signal) {
      const buyOrders = this.robot.orders.items.filter(order => order.figi === this.config.figi
        && order.direction === OrderDirection.ORDER_DIRECTION_BUY);
      const sellOrders = this.robot.orders.items.filter(order => order.figi === this.config.figi
        && order.direction === OrderDirection.ORDER_DIRECTION_SELL);
      await this.robot.portfolio.loadPositionsWithBlocked();
      if (signal === 'buy') await this.buy(buyOrders);
      if (signal === 'sell') await this.sell(sellOrders);
    }
  }

  /**
   * Покупка.
   */
  protected async buy(orders?: OrderState[]) {
    if (this.failsCounter.buy < 5 && orders.length > 0) {
      this.logger.warn(`Есть заявки на покупку, лотов. Ждем исполнения... Попытка ${this.failsCounter.buy + 1} из 5`);
      this.failsCounter.buy += 1;
      return;
    } else {
      await this.robot.orders.cancelExistingOrders(this.config.figi, OrderDirection.ORDER_DIRECTION_BUY);
      this.failsCounter.buy = 0;
    }
    await super.buy();
  }

  /**
   * Продажа.
   */
  protected async sell(orders?: OrderState[]) {
    if (this.failsCounter.sell < 15 && orders.length > 0) {
      this.logger.warn(`Есть заявки на продажу, лотов. Ждем исполнения... Попытка ${this.failsCounter.sell + 1} из 15`);
      this.failsCounter.sell += 1;
      return;
    } else {
      await this.robot.orders.cancelExistingOrders(this.config.figi, OrderDirection.ORDER_DIRECTION_SELL);
      this.failsCounter.sell = 0;
    }
    await super.sell();
  }

}
