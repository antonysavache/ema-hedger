import { Injectable, Logger } from '@nestjs/common';
import { KlineData } from '../interfaces/trading.interface';

@Injectable()
export class BinanceService {
  private readonly logger = new Logger(BinanceService.name);
  private ws: any = null;
  private readonly baseUrl = 'https://api.binance.com';
  private readonly wsUrl = 'wss://stream.binance.com:9443/ws';
  
  constructor() {
    this.logger.log('🔗 Binance Service инициализирован (без WebSocket)');
  }

  // Получить топ торговые пары по объему
  async getTopSymbols(limit: number = 20): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v3/ticker/24hr`);
      const tickers = await response.json();
      
      // Фильтруем только USDT пары и сортируем по объему
      const usdtPairs = tickers
        .filter((ticker: any) => ticker.symbol.endsWith('USDT'))
        .sort((a: any, b: any) => parseFloat(b.volume) - parseFloat(a.volume))
        .slice(0, limit)
        .map((ticker: any) => ticker.symbol);

      this.logger.log(`📈 Получены топ ${limit} USDT пар: ${usdtPairs.slice(0, 5).join(', ')}...`);
      return usdtPairs;
    } catch (error) {
      this.logger.error(`❌ Ошибка получения символов: ${error.message}`);
      return [];
    }
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

  // Заглушка для подписки на klines (для тестирования)
  subscribeToKlines(
    symbols: string[], 
    interval: string = '5m',
    onKline: (kline: KlineData) => void,
    onError?: (error: Error) => void
  ): void {
    this.logger.log(`📊 Симуляция подписки на klines для ${symbols.length} символов (${interval})`);
    // В реальной реализации здесь будет WebSocket подключение
  }

  // Отключить соединение
  disconnect(): void {
    this.logger.log('🔌 Отключение (заглушка)');
  }

  // Получить статус соединения
  getConnectionStatus(): string {
    return 'SIMULATION_MODE';
  }
}
