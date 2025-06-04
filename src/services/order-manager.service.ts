import { Injectable, Logger } from '@nestjs/common';
import { Order, PositionGroup, StrategyStats, PartialCloseResult } from '../interfaces/trading.interface';

@Injectable()
export class OrderManagerService {
  private readonly logger = new Logger(OrderManagerService.name);
  private readonly positions: Map<string, PositionGroup> = new Map();
  private readonly orderHistory: Order[] = [];
  private orderIdCounter = 1;
  private virtualBalance = 10000; // Стартовый баланс

  constructor() {
    this.logger.log('📋 Order Manager инициализирован');
  }

  // Открыть первичный LONG позицию (при пересечении EMA снизу вверх)
  openEntryLongOrder(symbol: string, price: number, quantity: number): Order {
    const order: Order = {
      id: `L${this.orderIdCounter++}`,
      symbol,
      side: 'LONG',
      type: 'ENTRY',
      quantity,
      price,
      timestamp: Date.now(),
      status: 'OPEN',
      orderIndex: this.getNextLongIndex(symbol),
    };

    this.addOrderToPosition(order);
    this.orderHistory.push(order);

    this.logger.log(`✅ ENTRY LONG ОТКРЫТ: ${symbol} | ID: ${order.id}`);
    this.logger.log(`   💰 Цена входа: ${price.toFixed(4)} USDT`);
    this.logger.log(`   📦 Количество: ${quantity.toFixed(4)}`);
    this.logger.log(`   💵 Объем: ${(price * quantity).toFixed(2)} USDT`);

    return order;
  }

  // Открыть LONG позицию для усреднения
  openAverageLongOrder(symbol: string, price: number, quantity: number): Order {
    const order: Order = {
      id: `L${this.orderIdCounter++}`,
      symbol,
      side: 'LONG',
      type: 'AVERAGE',
      quantity,
      price,
      timestamp: Date.now(),
      status: 'OPEN',
      orderIndex: this.getNextLongIndex(symbol),
    };

    this.addOrderToPosition(order);
    this.orderHistory.push(order);

    this.logger.log(`✅ AVERAGE LONG ОТКРЫТ: ${symbol} | ID: ${order.id}`);
    this.logger.log(`   💰 Цена входа: ${price.toFixed(4)} USDT`);
    this.logger.log(`   📦 Количество: ${quantity.toFixed(4)}`);
    this.logger.log(`   💵 Объем: ${(price * quantity).toFixed(2)} USDT`);

    return order;
  }

  // Открыть SHORT позицию (хедж равный объему всех лонгов)
  openHedgeShortOrder(symbol: string, price: number, totalLongSize: number): Order {
    const order: Order = {
      id: `S${this.orderIdCounter++}`,
      symbol,
      side: 'SHORT',
      type: 'HEDGE',
      quantity: totalLongSize,
      price,
      timestamp: Date.now(),
      status: 'OPEN',
    };

    this.addOrderToPosition(order);
    this.orderHistory.push(order);

    this.logger.log(`✅ HEDGE SHORT ОТКРЫТ: ${symbol} | ID: ${order.id}`);
    this.logger.log(`   💰 Цена входа: ${price.toFixed(4)} USDT`);
    this.logger.log(`   📦 Количество: ${totalLongSize.toFixed(4)} (= объему лонгов)`);
    this.logger.log(`   💵 Объем: ${(price * totalLongSize).toFixed(2)} USDT`);

    return order;
  }

  // Ключевая функция: закрыть максимальное количество последних лонгов с профитом
  closeLastProfitableLongs(symbol: string, currentPrice: number): PartialCloseResult {
    const position = this.positions.get(symbol);
    if (!position || position.longOrders.length === 0) {
      return {
        closedOrders: [],
        totalClosedQuantity: 0,
        totalPnl: 0,
        remainingLongSize: position?.totalLongSize || 0,
      };
    }

    const openLongs = position.longOrders
      .filter(o => o.status === 'OPEN')
      .sort((a, b) => (b.orderIndex || 0) - (a.orderIndex || 0)); // Сортируем от последних к первым

    const closedOrders: Order[] = [];
    let totalPnl = 0;
    let totalClosedQuantity = 0;

    // Проходим от последнего ордера к первому
    for (const order of openLongs) {
      const orderPnl = (currentPrice - order.price) * order.quantity;
      const potentialTotalPnl = totalPnl + orderPnl;

      // Если общий PnL остается положительным или нулевым, закрываем ордер
      if (potentialTotalPnl >= 0) {
        order.status = 'CLOSED';
        order.closePrice = currentPrice;
        order.closeTime = Date.now();
        order.pnl = orderPnl;

        closedOrders.push(order);
        totalPnl += orderPnl;
        totalClosedQuantity += order.quantity;

        this.logger.log(`💰 LONG ЗАКРЫТ: ${symbol} | ID: ${order.id}`);
        this.logger.log(`   📊 Цена входа: ${order.price.toFixed(4)} → Цена выхода: ${currentPrice.toFixed(4)}`);
        this.logger.log(`   📦 Количество: ${order.quantity.toFixed(4)}`);
        this.logger.log(`   💵 PnL: ${orderPnl >= 0 ? '+' : ''}${orderPnl.toFixed(2)} USDT`);
      } else {
        // Если добавление этого ордера делает общий PnL отрицательным, останавливаемся
        break;
      }
    }

    // Обновляем баланс
    this.virtualBalance += totalPnl;

    // Обновляем позицию
    this.updatePositionStats(position);

    const remainingLongSize = position.totalLongSize;

    this.logger.log(
      `📊 ${symbol}: Закрыто ${closedOrders.length} ордеров | ` +
      `Общий PnL: +${totalPnl.toFixed(2)} USDT | ` +
      `Осталось лонгов: ${remainingLongSize.toFixed(4)}`
    );

    return {
      closedOrders,
      totalClosedQuantity,
      totalPnl,
      remainingLongSize,
    };
  }

  // Скорректировать размер шорта после частичного закрытия лонгов
  adjustHedgeSize(symbol: string, currentPrice: number, newLongSize: number): Order | null {
    const position = this.positions.get(symbol);
    if (!position) return null;

    // Закрываем все существующие шорты
    this.closeAllShorts(symbol, currentPrice);

    // Если есть лонги, открываем новый хедж
    if (newLongSize > 0) {
      return this.openHedgeShortOrder(symbol, currentPrice, newLongSize);
    }

    return null;
  }

  // Закрыть все SHORT ордера
  closeAllShorts(symbol: string, currentPrice: number): Order[] {
    const position = this.positions.get(symbol);
    if (!position) return [];

    const closedOrders: Order[] = [];

    for (const order of position.shortOrders.filter(o => o.status === 'OPEN')) {
      const pnl = (order.price - currentPrice) * order.quantity; // Для шорта PnL инвертирован
      order.status = 'CLOSED';
      order.closePrice = currentPrice;
      order.closeTime = Date.now();
      order.pnl = pnl;
      
      this.virtualBalance += pnl;
      closedOrders.push(order);
      
      this.logger.log(`💜 SHORT ЗАКРЫТ: ${symbol} | ID: ${order.id}`);
      this.logger.log(`   📊 Цена входа: ${order.price.toFixed(4)} → Цена выхода: ${currentPrice.toFixed(4)}`);
      this.logger.log(`   📦 Количество: ${order.quantity.toFixed(4)}`);
      this.logger.log(`   💵 PnL: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT`);
    }

    // Обновляем позицию
    this.updatePositionStats(position);

    return closedOrders;
  }

  // Получить следующий индекс для лонг ордера
  private getNextLongIndex(symbol: string): number {
    const position = this.positions.get(symbol);
    if (!position) return 1;
    return position.lastLongIndex + 1;
  }

  // Добавить ордер к позиции
  private addOrderToPosition(order: Order): void {
    if (!this.positions.has(order.symbol)) {
      this.positions.set(order.symbol, {
        symbol: order.symbol,
        longOrders: [],
        shortOrders: [],
        totalLongSize: 0,
        totalShortSize: 0,
        averageLongPrice: 0,
        unrealizedPnl: 0,
        isHedged: false,
        lastLongIndex: 0,
      });
    }

    const position = this.positions.get(order.symbol)!;

    if (order.side === 'LONG') {
      position.longOrders.push(order);
      if (order.orderIndex && order.orderIndex > position.lastLongIndex) {
        position.lastLongIndex = order.orderIndex;
      }
    } else {
      position.shortOrders.push(order);
    }

    this.updatePositionStats(position);
  }

  // Обновить статистику позиции
  private updatePositionStats(position: PositionGroup): void {
    // Рассчитываем открытые лонги и шорты
    const openLongs = position.longOrders.filter(o => o.status === 'OPEN');
    const openShorts = position.shortOrders.filter(o => o.status === 'OPEN');

    position.totalLongSize = openLongs.reduce((sum, o) => sum + o.quantity, 0);
    position.totalShortSize = openShorts.reduce((sum, o) => sum + o.quantity, 0);

    // Средняя цена лонгов
    if (openLongs.length > 0) {
      const totalValue = openLongs.reduce((sum, o) => sum + (o.price * o.quantity), 0);
      position.averageLongPrice = totalValue / position.totalLongSize;
    }

    position.isHedged = position.totalShortSize > 0;

    // Если нет открытых позиций, удаляем из карты
    if (position.totalLongSize === 0 && position.totalShortSize === 0) {
      this.positions.delete(position.symbol);
    }
  }

  // Проверить, есть ли лонги без хеджа
  hasUnhedgedLongs(symbol: string): boolean {
    const position = this.positions.get(symbol);
    return position ? position.totalLongSize > 0 && !position.isHedged : false;
  }

  // Получить позицию по символу
  getPosition(symbol: string): PositionGroup | null {
    return this.positions.get(symbol) || null;
  }

  // Получить все активные позиции
  getAllPositions(): PositionGroup[] {
    return Array.from(this.positions.values());
  }

  // Рассчитать статистику
  getStats(): StrategyStats {
    const totalOrders = this.orderHistory.length;
    const longOrders = this.orderHistory.filter(o => o.side === 'LONG').length;
    const shortOrders = this.orderHistory.filter(o => o.side === 'SHORT').length;
    const closedOrders = this.orderHistory.filter(o => o.status === 'CLOSED');
    
    const totalPnl = closedOrders.reduce((sum, o) => sum + (o.pnl || 0), 0);
    const winningTrades = closedOrders.filter(o => (o.pnl || 0) > 0).length;
    const winRate = closedOrders.length > 0 ? (winningTrades / closedOrders.length) * 100 : 0;

    return {
      totalOrders,
      longOrders,
      shortOrders,
      closedOrders: closedOrders.length,
      totalPnl,
      winRate,
      activePositions: this.positions.size,
      balance: this.virtualBalance,
    };
  }

  // Получить баланс
  getBalance(): number {
    return this.virtualBalance;
  }

  // Очистить данные для символа
  clearPosition(symbol: string): void {
    this.positions.delete(symbol);
  }
}
