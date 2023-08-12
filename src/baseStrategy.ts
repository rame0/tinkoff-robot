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

import {
  CandleInterval,
  HistoricCandle,
  SubscriptionInterval
} from "tinkoff-invest-api/cjs/generated/marketdata";
import { RobotModule } from './utils/robot-module.js';
import { LimitOrderReq } from './account/orders.js';
import { Robot } from './robot.js';
import { ProfitLossSignalConfig } from './signals/profit-loss.js';
import { SmaCrossoverSignalConfig } from './signals/sma-corssover.js';
import { FigiInstrument } from './figi.js';
import { RsiCrossoverSignalConfig } from './signals/rsi-crossover.js';
import { Logger } from '@vitalets/logger';
import { SignalResult } from "./signals/base";
import { StrategyTypes } from "./strategies/strategyTypes.js";
import { OrderDirection } from "tinkoff-invest-api/cjs/generated/orders.js";

export interface StrategyConfig {
  /** ID инструмента */
  figi: string,
  /** Кол-во лотов в заявке на покупку */
  orderLots: number,
  /** Комиссия брокера, % от суммы сделки */
  brokerFee: number,
  /** Тип стратегии */
  strategyType: StrategyTypes,
  /** Интервал свечей */
  candleInterval: CandleInterval,
  /** Интервал обновления по подписке */
  subscriptionInterval?: SubscriptionInterval,
  /** Конфиг сигнала по отклонению текущей цены */
  profit?: ProfitLossSignalConfig,
  /** Конфиг сигнала по скользящим средним */
  sma?: SmaCrossoverSignalConfig,
  /** Конфиг сигнала по RSI */
  rsi?: RsiCrossoverSignalConfig,

  /** Сколько сигналов к покупке/продаже должно прийти, перед тем как отменять текущий ордер */
  keepOrdersAlive: {
    buy: number,
    sell: number,
  },
}

export class BaseStrategy extends RobotModule {
  instrument: FigiInstrument;
  totalProfit = 0;
  currentProfit = 0;
  requiredCandlesCount = 0;
  maxHistory = 0;
  lastTime: Date = new Date(0);
  delay = 0;
  failsCounter = { 'buy': 0, 'sell': 0 };

  constructor(robot: Robot, public config: StrategyConfig) {
    super(robot);
    this.logger = new Logger({ prefix: `[strategy_${config.figi}]:`, level: robot.logger.level });
    this.instrument = new FigiInstrument(robot, this.config.figi);
    this.requiredCandlesCount = this.calcRequiredCandlesCount();
    // this.maxHistory = Math.max(this.requiredCandlesCount * 2, 300);
    this.maxHistory = this.requiredCandlesCount;
  }

  /**
   * Входная точка: запуск стратегии.
   */
  async run(newCandle?: HistoricCandle) {
    await this.instrument.loadInfo();
    if (!this.instrument.isTradingAvailable()) return;

    await this.addOrLoadCandles(newCandle);
    await this.robot.orders.load();
    this.calcCurrentProfit();
    const signal = this.calcSignal();
    if (signal) {
      await this.robot.portfolio.loadPositionsWithBlocked();
      if (signal === 'buy') await this.buy();
      if (signal === 'sell') await this.sell();
    }
  }

  /**
   * Загрузка свечей.
   */
  protected async addOrLoadCandles(newCandle?: HistoricCandle) {

    if (newCandle === undefined || this.instrument.candles.length < this.requiredCandlesCount) {
      await this.instrument.loadCandles({
        interval: this.config.candleInterval,
        minCount: this.requiredCandlesCount,
      });
    } else {
      this.instrument.candles.push(newCandle);
      if (this.instrument.candles.length > this.maxHistory) {
        this.instrument.candles.shift();
      }
    }
  }

  /**
   * Расчет сигнала к покупке или продаже.
   * todo: здесь может быть более сложная логика комбинации нескольких сигналов.
   */
  protected calcSignal(): SignalResult {
    throw new Error('This is base class. Implement your strategy');
  }

  /**
   * Расчет необходимого кол-ва свечей, чтобы хватило всем сигналам.
   */
  protected calcRequiredCandlesCount(): number {
    throw new Error('This is base class. Implement your strategy');
  }

  /**
   * Покупка.
   */
  protected async buy() {
    if (!await this.checkCancelBuyOrders()) {
      return;
    }
    const availableLots = this.calcAvailableLots();
    if (availableLots > 0) {
      this.logger.warn(`Позиция уже в портфеле, лотов ${availableLots}. Ждем сигнала к продаже...`);
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

  protected async checkCancelBuyOrders() {
    const orders = this.robot.orders.items.filter(order => order.figi === this.config.figi
      && order.direction === OrderDirection.ORDER_DIRECTION_BUY);
    if (this.failsCounter.buy < this.config.keepOrdersAlive.buy && orders.length > 0) {
      this.logger.warn(`Есть заявки на покупку, лотов. Ждем исполнения... Попытка ${this.failsCounter.buy + 1} из 5`);
      this.failsCounter.buy += 1;
      return false;
    } else {
      await this.robot.orders.cancelExistingOrders(this.config.figi, OrderDirection.ORDER_DIRECTION_BUY);
      this.failsCounter.buy = 0;
      return true;
    }
  }

  /**
   * Продажа.
   */
  protected async sell() {
    if (!await this.checkCancelSellOrders()) {
      return;
    }

    const availableLots = this.calcAvailableLots();
    if (availableLots === 0) {
      this.logger.warn(`Позиции в портфеле нет. Ждем сигнала к покупке...`);
      return;
    }

    const currentPrice = this.instrument.getCurrentPrice();

    const orderReq: LimitOrderReq = {
      figi: this.config.figi,
      direction: OrderDirection.ORDER_DIRECTION_SELL,
      quantity: availableLots, // продаем все, что есть
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

  protected async checkCancelSellOrders() {
    const orders = this.robot.orders.items.filter(order => order.figi === this.config.figi
      && order.direction === OrderDirection.ORDER_DIRECTION_SELL);
    if (this.failsCounter.sell < this.config.keepOrdersAlive.sell && orders.length > 0) {
      this.logger.warn(`Есть заявки на продажу, лотов. Ждем исполнения... Попытка ${this.failsCounter.sell + 1} из 15`);
      this.failsCounter.sell += 1;
      return false;
    } else {
      await this.robot.orders.cancelExistingOrders(this.config.figi, OrderDirection.ORDER_DIRECTION_SELL);
      this.failsCounter.sell = 0;
      return true;
    }
  }

  /**
   * Кол-во лотов в портфеле.
   */
  protected calcAvailableLots() {
    const availableQty = this.robot.portfolio.getAvailableQty(this.config.figi);
    const lotSize = this.instrument.getLotSize();
    return Math.round(availableQty / lotSize);
  }

  /**
   * Достаточно ли денег для заявки на покупку.
   */
  protected checkEnoughCurrency(orderReq: LimitOrderReq) {
    const price = this.api.helpers.toNumber(orderReq.price!);
    const orderPrice = price * orderReq.quantity * this.instrument.getLotSize();
    const orderPriceWithCommission = orderPrice * (1 + this.config.brokerFee / 100);
    const balance = this.robot.portfolio.getBalance();
    if (orderPriceWithCommission > balance) {
      this.logger.warn(`Недостаточно средств для покупки: ${orderPriceWithCommission} > ${balance}`);
      return false;
    }
    return true;
  }

  /**
   * Расчет профита в % за продажу 1 шт. инструмента по текущей цене (с учетом комиссий).
   * Вычисляется относительно цены покупки, которая берется из portfolio.
   */
  protected calcCurrentProfit() {
    const buyPrice = this.robot.portfolio.getBuyPrice(this.config.figi);
    if (!buyPrice) {
      this.currentProfit = 0;
      return;
    }
    const currentPrice = this.instrument.getCurrentPrice();
    const commission = (buyPrice + currentPrice) * this.config.brokerFee / 100;
    const profit = currentPrice - buyPrice - commission;
    this.currentProfit = 100 * profit / buyPrice;
  }

  protected logSignals(signals: Record<string, unknown>) {
    const time = this.instrument.candles[ this.instrument.candles.length - 1 ].time?.toLocaleString();
    this.logger.warn(`Сигналы: ${Object.keys(signals).map(k => `${k}=${signals[ k ] || 'wait'}`).join(', ')} (${time})`);
  }
}
