import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EMACalculatorService } from './services/ema-calculator.service';
import { OrderManagerService } from './services/order-manager.service';
import { EMAHedgerStrategyService } from './services/ema-hedger-strategy.service';
import { BinanceService } from './services/binance.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [
    AppService,
    EMACalculatorService,
    OrderManagerService,
    EMAHedgerStrategyService,
    BinanceService,
  ],
})
export class AppModule {}
