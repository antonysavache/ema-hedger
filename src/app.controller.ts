import { Controller, Get, Post, Body, Query, Logger } from '@nestjs/common';
import { AppService } from './app.service';
import { EMAHedgerStrategyService } from './services/ema-hedger-strategy.service';
import { BinanceService } from './services/binance.service';
import { KlineData } from './interfaces/trading.interface';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    private readonly appService: AppService,
    private readonly strategy: EMAHedgerStrategyService,
    private readonly binanceService: BinanceService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('status')
  getStrategyStatus() {
    return this.strategy.getStrategyStatus();
  }

  @Get('top-symbols')
  async getTopSymbols(@Query('limit') limit?: string) {
    const symbolLimit = parseInt(limit || '20') || 20;
    const symbols = await this.binanceService.getTopSymbols(symbolLimit);
    return {
      count: symbols.length,
      symbols,
    };
  }

  @Post('process-kline')
  async processKline(@Body() kline: KlineData) {
    await this.strategy.processKline(kline);
    return { message: 'Kline processed', symbol: kline.symbol };
  }

  @Get('stats')
  logStats() {
    this.strategy.logStats();
    return { message: 'Stats logged to console' };
  }

  // Процесс симуляции с быстрой инициализацией EMA
  @Post('simulate-price-movement')
  async simulatePriceMovement(
    @Body() data: { symbol: string; prices: number[] },
  ) {
    const { symbol, prices } = data;

    // Сначала быстро инициализируем EMA историческими данными
    this.logger.log(`⚡ Быстрая инициализация EMA(130) для ${symbol}...`);
    const historicalKlines = await this.binanceService.getHistoricalKlines(
      symbol,
      '5m',
      150,
    );

    // Обрабатываем исторические данные для построения EMA
    for (const kline of historicalKlines) {
      await this.strategy.processKline(kline);
    }
    this.logger.log(`✅ EMA инициализирована для ${symbol}`);

    // Теперь симулируем движение цены
    for (let i = 0; i < prices.length; i++) {
      const price = prices[i];
      const kline: KlineData = {
        symbol,
        openTime: Date.now() - 1000,
        closeTime: Date.now(),
        open: i > 0 ? prices[i - 1].toString() : price.toString(),
        high: price.toString(),
        low: price.toString(),
        close: price.toString(),
        volume: '1000',
      };

      await this.strategy.processKline(kline);

      // Небольшая задержка для реалистичности
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    return this.strategy.getStrategyStatus();
  }
}
