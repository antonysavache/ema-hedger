import { Injectable, Logger } from '@nestjs/common';
import { BinanceService } from './binance.service';
import { EMAHedgerStrategyService } from './ema-hedger-strategy.service';
import { KlineData } from '../interfaces/trading.interface';

@Injectable()
export class MultiSymbolManagerService {
  private readonly logger = new Logger(MultiSymbolManagerService.name);
  private activeSymbols: string[] = [];
  private isTrading = false;
  private simulationInterval: NodeJS.Timeout | null = null;

  constructor(
    private binanceService: BinanceService,
    private strategy: EMAHedgerStrategyService,
  ) {
    this.logger.log('🎯 Multi Symbol Manager инициализирован');
  }

  // Начать торговлю по топ символам
  async startTradingTopSymbols(count: number = 150): Promise<void> {
    if (this.isTrading) {
      this.logger.warn('⚠️ Торговля уже запущена');
      return;
    }

    this.logger.log(`🚀 Запуск торговли по топ ${count} символам...`);

    try {
      // Получаем топ символы
      this.activeSymbols = await this.binanceService.getTopSymbols(count);
      
      if (this.activeSymbols.length === 0) {
        throw new Error('Не удалось получить список символов');
      }

      this.logger.log(`✅ Получено ${this.activeSymbols.length} символов для торговли`);
      this.logger.log(`📊 Активные символы: ${this.activeSymbols.slice(0, 10).join(', ')}...`);

      // Инициализируем EMA для всех символов
      await this.initializeEMAForSymbols();

      this.isTrading = true;
      this.logger.log(`🎯 Торговля запущена по ${this.activeSymbols.length} символам`);

      // В продакшене здесь будет WebSocket подписка
      // Пока запускаем симуляцию для демонстрации
      if (process.env.NODE_ENV !== 'production') {
        this.startSimulation();
      }

    } catch (error) {
      this.logger.error(`❌ Ошибка запуска торговли: ${error.message}`);
      throw error;
    }
  }

  // Инициализация EMA для всех символов с реальными историческими данными
  private async initializeEMAForSymbols(): Promise<void> {
    this.logger.log(`⚡ БЫСТРАЯ инициализация EMA(130) для ${this.activeSymbols.length} символов...`);
    this.logger.log(`📊 Получаем исторические данные с Binance...`);
    
    let successCount = 0;
    let failCount = 0;

    // Обрабатываем символы батчами для избежания rate limit
    const batchSize = 5;
    for (let i = 0; i < this.activeSymbols.length; i += batchSize) {
      const batch = this.activeSymbols.slice(i, i + batchSize);
      
      // Обрабатываем батч параллельно
      const batchPromises = batch.map(async (symbol) => {
        try {
          // Получаем реальные исторические данные
          const historicalKlines = await this.binanceService.getHistoricalKlines(symbol, '5m', 200);
          
          if (historicalKlines.length < 130) {
            throw new Error(`Недостаточно исторических данных: ${historicalKlines.length}/130`);
          }

          // Быстро обрабатываем все исторические данные
          for (const kline of historicalKlines) {
            await this.strategy.processKline(kline);
          }
          
          return { symbol, success: true };
        } catch (error) {
          this.logger.error(`❌ Ошибка инициализации ${symbol}: ${error.message}`);
          return { symbol, success: false };
        }
      });

      // Ждем завершения батча
      const results = await Promise.all(batchPromises);
      
      // Подсчитываем результаты
      results.forEach(result => {
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      });

      // Логируем прогресс
      const processed = i + batch.length;
      this.logger.log(`📈 Обработано ${processed}/${this.activeSymbols.length} символов | ✅ ${successCount} | ❌ ${failCount}`);
      
      // Небольшая пауза между батчами для соблюдения rate limit
      if (i + batchSize < this.activeSymbols.length) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 секунда пауза
      }
    }

    this.logger.log(`✅ Инициализация завершена: ${successCount} успешно, ${failCount} ошибок`);
    this.logger.log(`🚀 Стратегия готова к торговле!`);
  }

  // Симуляция торговли (для демонстрации)
  private startSimulation(): void {
    this.logger.log(`🎭 Запуск симуляции торговли (каждые 30 секунд = 5-минутная свеча)`);

    this.simulationInterval = setInterval(async () => {
      await this.simulateMarketTick();
    }, 30000); // 30 секунд = одна симуляция 5-минутной свечи
  }

  // Симуляция тика рынка
  private async simulateMarketTick(): Promise<void> {
    if (!this.isTrading) return;

    try {
      // Получаем текущие цены для случайных символов (симулируем активность)
      const randomSymbols = this.getRandomSymbols(5); // Берем 5 случайных символов
      const prices = await this.binanceService.getMultiplePrices(randomSymbols);

      for (const [symbol, price] of prices) {
        // Создаем симуляцию kline с небольшими изменениями цены
        const variation = (Math.random() - 0.5) * 0.02; // ±1% изменение
        const newPrice = price * (1 + variation);

        const kline: KlineData = {
          symbol,
          openTime: Date.now() - 5 * 60 * 1000,
          closeTime: Date.now(),
          open: price.toString(),
          high: Math.max(price, newPrice).toString(),
          low: Math.min(price, newPrice).toString(),
          close: newPrice.toString(),
          volume: '100000',
        };

        // Обрабатываем симулированную свечу
        await this.strategy.processKline(kline);
      }

    } catch (error) {
      this.logger.error(`❌ Ошибка симуляции: ${error.message}`);
    }
  }

  // Получить случайные символы для симуляции
  private getRandomSymbols(count: number): string[] {
    const shuffled = [...this.activeSymbols].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  // Остановить торговлю
  async stopTrading(): Promise<void> {
    if (!this.isTrading) {
      this.logger.warn('⚠️ Торговля не запущена');
      return;
    }

    this.logger.log('🛑 Остановка торговли...');

    this.isTrading = false;
    
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    this.binanceService.disconnect();
    this.logger.log('✅ Торговля остановлена');
  }

  // Получить статус торговли
  getTradingStatus(): any {
    return {
      isTrading: this.isTrading,
      activeSymbolsCount: this.activeSymbols.length,
      activeSymbols: this.activeSymbols.slice(0, 20), // Показываем первые 20
      mode: process.env.NODE_ENV === 'production' ? 'LIVE' : 'SIMULATION',
      connectionStatus: this.binanceService.getConnectionStatus(),
    };
  }

  // Получить активные символы
  getActiveSymbols(): string[] {
    return this.activeSymbols;
  }

  // Обработать входящую kline (для реального WebSocket)
  async processIncomingKline(kline: KlineData): Promise<void> {
    if (!this.isTrading) return;
    
    // Проверяем, что символ в нашем списке
    if (!this.activeSymbols.includes(kline.symbol)) return;

    await this.strategy.processKline(kline);
  }

  // Добавить новый символ с быстрой инициализацией
  async addSymbol(symbol: string): Promise<boolean> {
    if (this.activeSymbols.includes(symbol)) {
      this.logger.warn(`⚠️ Символ ${symbol} уже отслеживается`);
      return false;
    }

    try {
      this.logger.log(`⚡ Добавление символа ${symbol} с быстрой инициализацией...`);
      
      // Проверяем, что символ существует
      const price = await this.binanceService.getCurrentPrice(symbol);
      if (!price) {
        throw new Error(`Не удалось получить цену для ${symbol}`);
      }

      // Получаем исторические данные и инициализируем EMA
      const historicalKlines = await this.binanceService.getHistoricalKlines(symbol, '5m', 200);
      
      if (historicalKlines.length < 130) {
        this.logger.warn(`⚠️ Недостаточно исторических данных для ${symbol}: ${historicalKlines.length}/130`);
        // Все равно добавляем, но предупреждаем
      }

      // Быстро обрабатываем исторические данные
      for (const kline of historicalKlines) {
        await this.strategy.processKline(kline);
      }

      this.activeSymbols.push(symbol);
      this.logger.log(`✅ Символ ${symbol} добавлен и инициализирован (${historicalKlines.length} свечей)`);
      
      return true;
    } catch (error) {
      this.logger.error(`❌ Ошибка добавления символа ${symbol}: ${error.message}`);
      return false;
    }
  }

  // Удалить символ из торговли
  removeSymbol(symbol: string): boolean {
    const index = this.activeSymbols.indexOf(symbol);
    if (index === -1) {
      this.logger.warn(`⚠️ Символ ${symbol} не найден в списке`);
      return false;
    }

    this.activeSymbols.splice(index, 1);
    this.logger.log(`🗑️ Удален символ: ${symbol}`);
    return true;
  }
}
