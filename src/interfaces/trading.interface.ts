export interface KlineData {
  symbol: string;
  openTime: number;
  closeTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export interface EMAData {
  symbol: string;
  period: number;
  value: number;
  timestamp: number;
}

export interface Order {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  type: 'ENTRY' | 'AVERAGE' | 'HEDGE';
  quantity: number;
  price: number;
  timestamp: number;
  status: 'OPEN' | 'CLOSED';
  pnl?: number;
  closePrice?: number;
  closeTime?: number;
  orderIndex?: number; // Для отслеживания порядка ордеров
}

export interface PositionGroup {
  symbol: string;
  longOrders: Order[];
  shortOrders: Order[];
  totalLongSize: number;
  totalShortSize: number;
  averageLongPrice: number;
  unrealizedPnl: number;
  isHedged: boolean;
  lastLongIndex: number; // Индекс последнего лонг ордера
}

export interface EMASignal {
  symbol: string;
  type: 'CROSS_UP' | 'CROSS_DOWN';
  currentPrice: number;
  emaValue: number;
  timestamp: number;
}

export interface StrategyStats {
  totalOrders: number;
  longOrders: number;
  shortOrders: number;
  closedOrders: number;
  totalPnl: number;
  winRate: number;
  activePositions: number;
  balance: number;
}

export interface PartialCloseResult {
  closedOrders: Order[];
  totalClosedQuantity: number;
  totalPnl: number;
  remainingLongSize: number;
}
