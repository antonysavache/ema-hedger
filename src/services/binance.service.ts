import { Injectable, Logger } from '@nestjs/common';
import { KlineData } from '../interfaces/trading.interface';

@Injectable()
export class BinanceService {
  private readonly logger = new Logger(BinanceService.name);
  private ws: any = null;
  private readonly baseUrl = 'https://api.binance.com';
  private readonly wsUrl = 'wss://stream.binance.com:9443/ws';
  
  constructor() {
    this.logger.log('🔗 Binance Service инициализирован');
  }

  // Получить топ торговые пары по объему
  async getTopSymbols(limit: number = 150): Promise<string[]> {
    try {
      this.logger.log(`📊 Получение топ ${limit} USDT пар...`);
      const response = await fetch(`${this.baseUrl}/api/v3/ticker/24hr`);
      const tickers = await response.json();
      
      // Фильтруем только USDT пары, исключаем стейблкоины
      const excludeList = ['USDCUSDT', 'BUSDUSDT', 'TUSDUSDT', 'DAIUSDT', 'USTCUSDT', 'FDUSDUSDT'];
      
      const usdtPairs = tickers
        .filter((ticker: any) => {
          const symbol = ticker.symbol;
          return symbol.endsWith('USDT') && 
                 !excludeList.includes(symbol) &&
                 parseFloat(ticker.volume) > 1000000; // Минимальный объем 1M USDT
        })
        .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        .slice(0, limit)
        .map((ticker: any) => ticker.symbol);

      this.logger.log(`✅ Получено ${usdtPairs.length} монет. Топ-10: ${usdtPairs.slice(0, 10).join(', ')}...`);
      
      return usdtPairs;
    } catch (error) {
      this.logger.error(`❌ Ошибка получения символов: ${error.message}`);
      // Возвращаем дефолтный список основных монет
      return [
        'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 
        'SOLUSDT', 'DOGEUSDT', 'DOTUSDT', 'MATICUSDT', 'AVAXUSDT'
      ];
    }
  }

  // Получить исторические klines для инициализации EMA
  async getHistoricalKlines(symbol: string, interval: string = '5m', limit: number = 200): Promise<KlineData[]> {
    try {
      this.logger.log(`📊 Получение ${limit} исторических свечей для ${symbol}...`);
      
      const response = await fetch(
        `${this.baseUrl}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      const klines: KlineData[] = data.map((candle: any[]) => ({
        symbol,
        openTime: candle[0],
        closeTime: candle[6],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5],
      }));
      
      this.logger.log(`✅ Получено ${klines.length} исторических свечей для ${symbol}`);
      return klines;
      
    } catch (error) {
      this.logger.error(`❌ Ошибка получения исторических данных для ${symbol}: ${error.message}`);
      // Fallback к симулированным данным
      return this.simulateKlineData(symbol);
    }
  }

  // Получить цены для нескольких символов сразу
  async getMultiplePrices(symbols: string[]): Promise<Map<string, number>> {
    const priceMap = new Map<string, number>();
    
    try {
      const response = await fetch(`${this.baseUrl}/api/v3/ticker/price`);
      const allPrices = await response.json();
      
      const symbolsSet = new Set(symbols);
      
      for (const ticker of allPrices) {
        if (symbolsSet.has(ticker.symbol)) {
          priceMap.set(ticker.symbol, parseFloat(ticker.price));
        }
      }
      
      this.logger.log(`📊 Получены цены для ${priceMap.size}/${symbols.length} символов`);
      
    } catch (error) {
      this.logger.error(`❌ Ошибка получения множественных цен: ${error.message}`);
    }
    
    return priceMap;
  }

  // Получить текущую цену символа
  async getCurrentPrice(symbol: string): Promise<number | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v3/ticker/price?symbol=${symbol}`);
      const data = await response.json();
      return parseFloat(data.price);
    } catch (error) {
      this.logger.error(`❌ Ошибка получения цены ${symbol}: ${error.message}`);
      return null;
    }
  }

  // Симуляция kline данных для тестирования
  async simulateKlineData(symbol: string, priceRange: number[] = []): Promise<KlineData[]> {
    this.logger.log(`🎭 Генерация тестовых kline данных для ${symbol}`);
    
    const currentPrice = await this.getCurrentPrice(symbol) || 50000;
    const baseTime = Date.now() - (200 * 5 * 60 * 1000); // 200 свечей назад
    
    const klines: KlineData[] = [];
    
    // Если передан диапазон цен, используем его, иначе генерируем
    const prices = priceRange.length > 0 ? priceRange : this.generatePriceMovement(currentPrice, 200);
    
    for (let i = 0; i < prices.length; i++) {
      const openTime = baseTime + (i * 5 * 60 * 1000);
      const closeTime = openTime + (5 * 60 * 1000) - 1;
      
      const price = prices[i];
      const variation = price * 0.001;
      
      klines.push({
        symbol,
        openTime,
        closeTime,
        open: i > 0 ? prices[i-1].toString() : price.toString(),
        high: (price + variation).toString(),
        low: (price - variation).toString(),
        close: price.toString(),
        volume: '1000000',
      });
    }
    
    return klines;
  }

  // Генерация реалистичного движения цены
  private generatePriceMovement(startPrice: number, count: number): number[] {
    const prices: number[] = [];
    let currentPrice = startPrice;
    
    for (let i = 0; i < count; i++) {
      const change = (Math.random() - 0.5) * 0.02;
      currentPrice = currentPrice * (1 + change);
      prices.push(currentPrice);
    }
    
    return prices;
  }

  // Заглушка для подписки на klines
  subscribeToKlines(
    symbols: string[], 
    interval: string = '5m',
    onKline: (kline: KlineData) => void,
    onError?: (error: Error) => void
  ): void {
    this.logger.log(`📊 SIMULATION MODE: подписка на ${symbols.length} символов (${interval})`);
  }

  // Отключить соединение
  disconnect(): void {
    this.logger.log('🔌 Отключение Binance сервиса');
  }

  // Получить статус соединения
  getConnectionStatus(): string {
    return 'SIMULATION_MODE';
  }
}
