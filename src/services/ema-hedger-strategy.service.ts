import { Injectable, Logger } from '@nestjs/common';
import { KlineData, EMASignal } from '../interfaces/trading.interface';
import { EMACalculatorService } from './ema-calculator.service';
import { OrderManagerService } from './order-manager.service';

@Injectable()
export class EMAHedgerStrategyService {
  private readonly logger = new Logger(EMAHedgerStrategyService.name);
  private readonly emaPeriod = 50; // Период EMA
  private readonly orderSize = 100; // Размер ордера в USDT

  constructor(
    private emaCalculator: EMACalculatorService,
    private orderManager: OrderManagerService,
  ) {
    this.logger.log('🎯 EMA Hedger Strategy инициализирован');
    this.logger.log(`📊 Настройки: EMA ${this.emaPeriod}, Размер ордера ${this.orderSize} USDT`);
  }

  // Основная логика обработки свечи
  async processKline(kline: KlineData): Promise<void> {
    const symbol = kline.symbol;
    const currentPrice = parseFloat(kline.close);

    try {
      // 1. Обновляем EMA
      const emaData = this.emaCalculator.updateEMA(kline, this.emaPeriod);
      if (!emaData) {
        return; // Недостаточно данных для EMA
      }

      const emaValue = emaData.value;
      this.logger.debug(`📊 ${symbol}: Цена ${currentPrice.toFixed(4)} | EMA ${emaValue.toFixed(4)} | ${currentPrice > emaValue ? '⬆️ Выше' : '⬇️ Ниже'} EMA`);

      // 2. Проверяем пересечения EMA
      const signal = this.emaCalculator.detectEMACrossing(kline, this.emaPeriod);
      if (signal) {
        await this.handleEMASignal(signal);
      }

      // 3. Проверяем усреднение (если цена идет против нас)
      await this.checkForAveraging(symbol, currentPrice);

    } catch (error) {
      this.logger.error(`❌ Ошибка обработки ${symbol}: ${error.message}`);
    }
  }

  // Обработка сигналов пересечения EMA
  private async handleEMASignal(signal: EMASignal): Promise<void> {
    const { symbol, type, currentPrice } = signal;
    const position = this.orderManager.getPosition(symbol);
    const quantity = this.orderSize / currentPrice;

    this.logger.log(`\n🎯 === СИГНАЛ EMA для ${symbol} ===`);
    this.logger.log(`📈 Тип: ${type === 'CROSS_UP' ? '🟢 ПЕРЕСЕЧЕНИЕ СНИЗУ ВВЕРХ' : '🔴 ПЕРЕСЕЧЕНИЕ СВЕРХУ ВНИЗ'}`);
    this.logger.log(`💰 Цена: ${currentPrice.toFixed(4)} USDT`);

    if (type === 'CROSS_UP') {
      // Пересечение снизу вверх - открываем LONG
      
      if (!position || position.totalLongSize === 0) {
        // ПЕРВИЧНЫЙ ВХОД В ЛОНГ
        this.logger.log(`🚀 ДЕЙСТВИЕ: Открываем ПЕРВИЧНЫЙ ЛОНГ`);
        this.logger.log(`📦 Размер: ${quantity.toFixed(4)} (${this.orderSize} USDT)`);
        this.orderManager.openEntryLongOrder(symbol, currentPrice, quantity);
        this.logger.log(`✅ ПЕРВИЧНЫЙ ЛОНГ ОТКРЫТ`);
      } else {
        // УСРЕДНЕНИЕ ПО СИГНАЛУ
        this.logger.log(`📈 ДЕЙСТВИЕ: Усреднение по сигналу EMA`);
        this.logger.log(`📦 Добавляем лонг: ${quantity.toFixed(4)} к существующим ${position.totalLongSize.toFixed(4)}`);
        this.orderManager.openAverageLongOrder(symbol, currentPrice, quantity);
        this.logger.log(`✅ УСРЕДНЕНИЕ ЗАВЕРШЕНО`);
      }

      // Закрываем шорт если есть
      if (position && position.shortOrders.length > 0) {
        this.logger.log(`🔄 ДЕЙСТВИЕ: Закрываем существующие шорты`);
        const closedShorts = this.orderManager.closeAllShorts(symbol, currentPrice);
        this.logger.log(`✅ ЗАКРЫТО ${closedShorts.length} ШОРТОВ`);
      }

    } else if (type === 'CROSS_DOWN') {
      // Пересечение сверху вниз
      
      if (position && position.totalLongSize > 0) {
        this.logger.log(`📉 ДЕЙСТВИЕ: Частичное закрытие лонгов + хеджирование`);
        this.logger.log(`📊 Текущая позиция: ${position.totalLongSize.toFixed(4)} лонгов по средней ${position.averageLongPrice.toFixed(4)}`);

        // 1. Закрываем максимальное количество последних лонгов с профитом
        const closeResult = this.orderManager.closeLastProfitableLongs(symbol, currentPrice);
        
        if (closeResult.closedOrders.length > 0) {
          this.logger.log(`💰 ЗАКРЫТО ЛОНГОВ: ${closeResult.closedOrders.length} шт.`);
          this.logger.log(`💰 ПРОФИТ: +${closeResult.totalPnl.toFixed(2)} USDT`);
          this.logger.log(`📦 ЗАКРЫТО ОБЪЕМА: ${closeResult.totalClosedQuantity.toFixed(4)}`);
        } else {
          this.logger.log(`⚠️ НЕТ ПРИБЫЛЬНЫХ ЛОНГОВ ДЛЯ ЗАКРЫТИЯ`);
        }

        // 2. Если остались лонги, открываем хедж
        if (closeResult.remainingLongSize > 0) {
          this.logger.log(`🛡️ ДЕЙСТВИЕ: Открываем хедж на оставшиеся лонги`);
          this.logger.log(`📦 Размер хеджа: ${closeResult.remainingLongSize.toFixed(4)} (= объему оставшихся лонгов)`);
          this.orderManager.openHedgeShortOrder(symbol, currentPrice, closeResult.remainingLongSize);
          this.logger.log(`✅ ХЕДЖ ОТКРЫТ`);
        } else {
          this.logger.log(`✅ ВСЕ ЛОНГИ ЗАКРЫТЫ - ХЕДЖ НЕ НУЖЕН`);
        }
      } else {
        this.logger.log(`⚠️ НЕТ ОТКРЫТЫХ ЛОНГОВ - ДЕЙСТВИЙ НЕ ТРЕБУЕТСЯ`);
      }
    }

    this.logger.log(`🎯 === КОНЕЦ ОБРАБОТКИ СИГНАЛА ===\n`);
  }

  // Проверка на усреднение при движении цены вниз
  private async checkForAveraging(symbol: string, currentPrice: number): Promise<void> {
    const position = this.orderManager.getPosition(symbol);
    
    // Проверяем только если есть лонги
    if (!position || position.totalLongSize === 0) return;

    const isAboveEMA = this.emaCalculator.isPriceAboveEMA(symbol, currentPrice);
    if (isAboveEMA === null) return;

    // Логика усреднения:
    // 1. Если цена ниже EMA и у нас есть лонги без хеджа - открываем защитный хедж
    if (!isAboveEMA && this.orderManager.hasUnhedgedLongs(symbol)) {
      this.logger.log(`\n🛡️ === ЗАЩИТНЫЙ ХЕДЖ для ${symbol} ===`);
      this.logger.log(`⚠️ ПРИЧИНА: Цена упала ниже EMA, есть незахеджированные лонги`);
      this.logger.log(`📦 Размер хеджа: ${position.totalLongSize.toFixed(4)} (= объему всех лонгов)`);
      this.orderManager.openHedgeShortOrder(symbol, currentPrice, position.totalLongSize);
      this.logger.log(`✅ ЗАЩИТНЫЙ ХЕДЖ ОТКРЫТ\n`);
      return;
    }

    // 2. Если цена выше EMA, есть лонги и цена упала значительно от средней цены лонгов
    if (isAboveEMA && position.totalLongSize > 0) {
      const priceDropPercent = ((position.averageLongPrice - currentPrice) / position.averageLongPrice) * 100;
      
      // Усредняемся если цена упала более чем на 1% от средней цены лонгов
      if (priceDropPercent > 1.0) {
        const quantity = this.orderSize / currentPrice;
        
        this.logger.log(`\n📊 === УСРЕДНЕНИЕ для ${symbol} ===`);
        this.logger.log(`📉 ПРИЧИНА: Цена упала на ${priceDropPercent.toFixed(1)}% от средней цены лонгов`);
        this.logger.log(`📊 Средняя цена лонгов: ${position.averageLongPrice.toFixed(4)}`);
        this.logger.log(`📊 Текущая цена: ${currentPrice.toFixed(4)}`);
        this.logger.log(`📦 Добавляем лонг: ${quantity.toFixed(4)} (${this.orderSize} USDT)`);
        
        this.orderManager.openAverageLongOrder(symbol, currentPrice, quantity);
        
        // Если был хедж, корректируем его размер
        if (position.isHedged) {
          const newTotalLongSize = position.totalLongSize + quantity;
          this.logger.log(`🔄 ДЕЙСТВИЕ: Корректируем размер хеджа`);
          this.logger.log(`📦 Новый размер хеджа: ${newTotalLongSize.toFixed(4)}`);
          this.orderManager.adjustHedgeSize(symbol, currentPrice, newTotalLongSize);
          this.logger.log(`✅ ХЕДЖ СКОРРЕКТИРОВАН`);
        }
        
        this.logger.log(`✅ УСРЕДНЕНИЕ ЗАВЕРШЕНО\n`);
      }
    }
  }

  // Получить статус стратегии
  getStrategyStatus(): any {
    const stats = this.orderManager.getStats();
    const emaStats = this.emaCalculator.getStats();
    const positions = this.orderManager.getAllPositions();

    return {
      strategy: 'EMA Hedger v2.0',
      emaPeriod: this.emaPeriod,
      orderSize: this.orderSize,
      stats,
      emaTracking: emaStats.trackedSymbols,
      activePositions: positions.map(p => ({
        symbol: p.symbol,
        longOrders: p.longOrders.filter(o => o.status === 'OPEN').length,
        shortOrders: p.shortOrders.filter(o => o.status === 'OPEN').length,
        totalLongSize: p.totalLongSize.toFixed(4),
        totalShortSize: p.totalShortSize.toFixed(4),
        averagePrice: p.averageLongPrice.toFixed(4),
        isHedged: p.isHedged,
        lastIndex: p.lastLongIndex,
      })),
      description: {
        logic: 'EMA пересечения + умное усреднение + хеджирование',
        longEntry: 'Пересечение EMA снизу вверх',
        shortEntry: 'Пересечение EMA сверху вниз (хедж равный объему лонгов)',
        averaging: 'При падении >1% от средней цены лонгов выше EMA',
        partialClose: 'Закрытие максимального числа последних лонгов с общим профитом',
      },
    };
  }

  // Логирование статистики
  logStats(): void {
    const stats = this.orderManager.getStats();
    
    this.logger.log(`\n📊 === ОБЩАЯ СТАТИСТИКА ===`);
    this.logger.log(`💰 Баланс: ${stats.balance.toFixed(2)} USDT`);
    this.logger.log(`📈 Общий PnL: ${stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)} USDT`);
    this.logger.log(`📊 Всего ордеров: ${stats.totalOrders} (L: ${stats.longOrders}, S: ${stats.shortOrders})`);
    this.logger.log(`📊 Закрытых сделок: ${stats.closedOrders}`);
    this.logger.log(`📊 Винрейт: ${stats.winRate.toFixed(1)}%`);
    this.logger.log(`📊 Активных позиций: ${stats.activePositions}`);

    // Детали по активным позициям
    const positions = this.orderManager.getAllPositions();
    if (positions.length > 0) {
      this.logger.log(`\n🔥 === АКТИВНЫЕ ПОЗИЦИИ ===`);
      
      positions.forEach(p => {
        const openLongs = p.longOrders.filter(o => o.status === 'OPEN').length;
        const openShorts = p.shortOrders.filter(o => o.status === 'OPEN').length;
        const hedgeStatus = p.isHedged ? '🛡️ ЗАХЕДЖИРОВАНО' : '⚠️ БЕЗ ХЕДЖА';
        
        this.logger.log(`📍 ${p.symbol}:`);
        this.logger.log(`   📦 Лонгов: ${openLongs} шт. (${p.totalLongSize.toFixed(4)} объем)`);
        this.logger.log(`   📦 Шортов: ${openShorts} шт. (${p.totalShortSize.toFixed(4)} объем)`);
        this.logger.log(`   💰 Средняя цена лонгов: ${p.averageLongPrice.toFixed(4)}`);
        this.logger.log(`   ${hedgeStatus}`);
        this.logger.log(`   📊 Последний индекс: ${p.lastLongIndex}`);
      });
    }
    this.logger.log(`📊 === КОНЕЦ СТАТИСТИКИ ===\n`);
  }
}
