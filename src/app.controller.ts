import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { EMAHedgerStrategyService } from './services/ema-hedger-strategy.service';
import { KlineData } from './interfaces/trading.interface';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly strategy: EMAHedgerStrategyService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('status')
  getStrategyStatus() {
    return this.strategy.getStrategyStatus();
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

  @Post('simulate-price-movement')
  async simulatePriceMovement(@Body() data: { symbol: string; prices: number[] }) {
    const { symbol, prices } = data;
    
    for (let i = 0; i < prices.length; i++) {
      const price = prices[i];
      const kline: KlineData = {
        symbol,
        openTime: Date.now() - 1000,
        closeTime: Date.now(),
        open: i > 0 ? prices[i-1].toString() : price.toString(),
        high: price.toString(),
        low: price.toString(), 
        close: price.toString(),
        volume: '1000',
      };

      await this.strategy.processKline(kline);
      
      // Небольшая задержка для реалистичности
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return this.strategy.getStrategyStatus();
  }
}
