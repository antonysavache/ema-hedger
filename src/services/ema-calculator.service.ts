import { Injectable, Logger } from '@nestjs/common';
import { KlineData, EMAData, EMASignal } from '../interfaces/trading.interface';

@Injectable()
export class EMACalculatorService {
  private readonly logger = new Logger(EMACalculatorService.name);
  private readonly emaHistory: Map<string, number[]> = new Map(); // symbol -> price history
  private readonly emaValues: Map<string, number> = new Map(); // symbol -> current EMA
  private readonly previousEMAValues: Map<string, number> = new Map(); // для детекции пересечений

  constructor() {
    this.logger.log('📊 EMA Calculator инициализирован');
  }

  // Обновляем EMA на новой свече
  updateEMA(kline: KlineData, period: number = 130): EMAData | null {
    const symbol = kline.symbol;
    const price = parseFloat(kline.close);
    
    // Получаем историю цен для символа
    if (!this.emaHistory.has(symbol)) {
      this.emaHistory.set(symbol, []);
    }
    
    const prices = this.emaHistory.get(symbol)!;
    prices.push(price);
    
    // Ограничиваем историю (нужно только для начального расчета SMA)
    if (prices.length > period * 2) {
      prices.shift();
    }
    
    let emaValue: number;
    
    // Если данных недостаточно, используем SMA для инициализации
    if (prices.length < period) {
      return null; // Недостаточно данных
    } else if (prices.length === period) {
      // Первый расчет - используем SMA
      emaValue = prices.reduce((sum, p) => sum + p, 0) / period;
    } else {
      // Обычный расчет EMA
      const multiplier = 2 / (period + 1);
      const previousEMA = this.emaValues.get(symbol) || 0;
      emaValue = (price * multiplier) + (previousEMA * (1 - multiplier));
    }
    
    // Сохраняем предыдущее значение для детекции пересечений
    const previousValue = this.emaValues.get(symbol);
    if (previousValue !== undefined) {
      this.previousEMAValues.set(symbol, previousValue);
    }
    
    // Обновляем текущее значение
    this.emaValues.set(symbol, emaValue);
    
    return {
      symbol,
      period,
      value: emaValue,
      timestamp: kline.closeTime,
    };
  }

  // Детекция пересечения цены и EMA
  detectEMACrossing(kline: KlineData, period: number = 130): EMASignal | null {
    const symbol = kline.symbol;
    const currentPrice = parseFloat(kline.close);
    const previousPrice = parseFloat(kline.open);
    
    const currentEMA = this.emaValues.get(symbol);
    const previousEMA = this.previousEMAValues.get(symbol);
    
    if (!currentEMA || !previousEMA) {
      return null; // Недостаточно данных
    }
    
    // Проверяем пересечение снизу вверх (CROSS_UP)
    if (previousPrice <= previousEMA && currentPrice > currentEMA) {
      this.logger.log(`🔥 ${symbol}: Пересечение EMA СНИЗУ ВВЕРХ! Цена: ${currentPrice.toFixed(4)}, EMA: ${currentEMA.toFixed(4)}`);
      return {
        symbol,
        type: 'CROSS_UP',
        currentPrice,
        emaValue: currentEMA,
        timestamp: kline.closeTime,
      };
    }
    
    // Проверяем пересечение сверху вниз (CROSS_DOWN)
    if (previousPrice >= previousEMA && currentPrice < currentEMA) {
      this.logger.log(`❄️ ${symbol}: Пересечение EMA СВЕРХУ ВНИЗ! Цена: ${currentPrice.toFixed(4)}, EMA: ${currentEMA.toFixed(4)}`);
      return {
        symbol,
        type: 'CROSS_DOWN',
        currentPrice,
        emaValue: currentEMA,
        timestamp: kline.closeTime,
      };
    }
    
    return null;
  }

  // Получить текущее значение EMA
  getCurrentEMA(symbol: string): number | null {
    return this.emaValues.get(symbol) || null;
  }

  // Проверить, выше или ниже цена относительно EMA
  isPriceAboveEMA(symbol: string, price: number): boolean | null {
    const ema = this.getCurrentEMA(symbol);
    if (!ema) return null;
    return price > ema;
  }

  // Очистить данные для символа
  clearData(symbol: string): void {
    this.emaHistory.delete(symbol);
    this.emaValues.delete(symbol);
    this.previousEMAValues.delete(symbol);
  }

  // Получить статистику
  getStats(): any {
    return {
      trackedSymbols: this.emaValues.size,
      emaValues: Object.fromEntries(this.emaValues.entries()),
    };
  }
}
