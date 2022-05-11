/**
 * Расчет индикаторов.
 */
import { SMA, EMA } from '@debut/indicators';

export type Series = number[];

/**
 * Простое скользящее среднее, SMA
 */
export function sma(prices: Series, length: number) {
  const sma = new SMA(length);
  return prices.map(price => sma.nextValue(price));
}

/**
 * Экспоненциальное скользящее среднее, EMA
 */
 export function ema(prices: Series, length: number) {
  const sma = new EMA(length);
  return prices.map(price => sma.nextValue(price));
}

/**
 * Возвращает true если source1 пересек source2 сверху вниз
 */
export function crossover(source1: Series, source2: Series) {
  const [ prev1, cur1 ] = source1.slice(-2);
  const [ prev2, cur2 ] = source2.slice(-2);
  return cur1 > cur2 && prev1 < prev2;
}

/**
 * Возвращает true если source1 пересек source2 снизу вверх
 */
export function crossunder(source1: Series, source2: Series) {
  const [ prev1, cur1 ] = source1.slice(-2);
  const [ prev2, cur2 ] = source2.slice(-2);
  return cur1 > cur2 && prev1 < prev2;
}
