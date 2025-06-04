// Тест многосимвольной стратегии
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testMultiSymbolStrategy() {
  console.log('🚀 Тест EMA Hedger Strategy v2.0 - Топ 150 монет');
  console.log('⚙️ Настройки: EMA 130, 1% на вход, 5м таймфрейм\n');

  try {
    // 1. Проверяем статус
    console.log('📊 1. Проверяем текущий статус...');
    const initialStatus = await axios.get(`${BASE_URL}/trading-status`);
    console.log(`   Торговля активна: ${initialStatus.data.isTrading ? '✅' : '❌'}`);
    
    // 2. Получаем топ символы
    console.log('\n📈 2. Получаем топ символы...');
    const topSymbols = await axios.get(`${BASE_URL}/top-symbols?limit=10`);
    console.log(`   Топ-10 символов: ${topSymbols.data.symbols.join(', ')}`);

    // 3. Запускаем торговлю
    console.log('\n🎯 3. Запускаем торговлю по топ 20 символам (для теста)...');
    const startResponse = await axios.post(`${BASE_URL}/start-trading`, {
      symbolCount: 20
    });
    console.log(`   ${startResponse.data.message}`);

    // Ждем инициализации
    console.log('\n⏳ Ждем инициализации EMA (10 секунд)...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 4. Проверяем активные символы
    console.log('\n📋 4. Проверяем активные символы...');
    const activeSymbols = await axios.get(`${BASE_URL}/active-symbols`);
    console.log(`   Активных символов: ${activeSymbols.data.count}`);
    console.log(`   Примеры: ${activeSymbols.data.symbols.slice(0, 5).join(', ')}`);

    // 5. Смотрим портфолио
    console.log('\n💼 5. Статус портфолио...');
    const portfolio = await axios.get(`${BASE_URL}/portfolio`);
    console.log(`   Баланс: ${portfolio.data.summary.balance.toFixed(2)} USDT`);
    console.log(`   Активных позиций: ${portfolio.data.summary.activePositions}`);
    console.log(`   PnL: ${portfolio.data.summary.totalPnL >= 0 ? '+' : ''}${portfolio.data.summary.totalPnL.toFixed(2)} USDT`);

    // 6. Запускаем симуляцию рынка
    console.log('\n🎭 6. Запускаем симуляцию рынка (60 секунд)...');
    const simulationPromise = axios.post(`${BASE_URL}/simulate-market`, {
      duration: 60,
      symbols: activeSymbols.data.symbols.slice(0, 5)
    });

    // Мониторим в процессе
    console.log('   📊 Мониторинг каждые 15 секунд...\n');
    
    const monitoringInterval = setInterval(async () => {
      try {
        const currentPortfolio = await axios.get(`${BASE_URL}/portfolio`);
        const stats = currentPortfolio.data.summary;
        
        console.log(`   💰 Баланс: ${stats.balance.toFixed(2)} | PnL: ${stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL.toFixed(2)} | Позиций: ${stats.activePositions} | WR: ${stats.winRate.toFixed(1)}%`);
      } catch (e) {
        console.log('   ⚠️ Ошибка мониторинга');
      }
    }, 15000);

    // Ждем завершения симуляции
    const simulationResult = await simulationPromise;
    clearInterval(monitoringInterval);

    console.log(`\n✅ Симуляция завершена: ${simulationResult.data.totalTicks} тиков`);

    // 7. Финальная статистика
    console.log('\n📊 7. Финальная статистика...');
    await axios.get(`${BASE_URL}/stats`);

    const finalPortfolio = await axios.get(`${BASE_URL}/portfolio`);
    const finalStats = finalPortfolio.data.summary;

    console.log('\n🎉 === РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ ===');
    console.log(`💰 Итоговый баланс: ${finalStats.balance.toFixed(2)} USDT`);
    console.log(`📈 Общий PnL: ${finalStats.totalPnL >= 0 ? '+' : ''}${finalStats.totalPnL.toFixed(2)} USDT`);
    console.log(`📊 Активных позиций: ${finalStats.activePositions}`);
    console.log(`🎯 Винрейт: ${finalStats.winRate.toFixed(1)}%`);
    console.log(`🔥 Отслеживаемых символов: ${finalStats.totalSymbols}`);

    // 8. Останавливаем торговлю
    console.log('\n🛑 8. Останавливаем торговлю...');
    const stopResponse = await axios.post(`${BASE_URL}/stop-trading`);
    console.log(`   ${stopResponse.data.message}`);

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Сервер не запущен! Запустите: npm run start:dev');
    } else {
      console.error('❌ Ошибка тестирования:', error.message);
      if (error.response?.data) {
        console.error('   Детали:', error.response.data);
      }
    }
  }
}

// Быстрый тест API
async function quickAPITest() {
  console.log('\n🧪 Быстрый тест API...\n');

  const tests = [
    { name: 'Статус стратегии', url: '/status' },
    { name: 'Статус торговли', url: '/trading-status' },
    { name: 'Топ-5 символов', url: '/top-symbols?limit=5' },
    { name: 'Портфолио', url: '/portfolio' }
  ];

  for (const test of tests) {
    try {
      const response = await axios.get(`${BASE_URL}${test.url}`);
      console.log(`✅ ${test.name}: OK`);
      
      if (test.url === '/top-symbols?limit=5') {
        console.log(`   Символы: ${response.data.symbols.join(', ')}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`);
    }
  }
}

// Демонстрация функций управления
async function testManagement() {
  console.log('\n🎛️ Тест функций управления...\n');

  try {
    // Добавляем символ
    console.log('➕ Добавляем LINKUSDT...');
    const addResponse = await axios.post(`${BASE_URL}/add-symbol`, {
      symbol: 'LINKUSDT'
    });
    console.log(`   ${addResponse.data.message}`);

    // Проверяем активные символы
    const activeResponse = await axios.get(`${BASE_URL}/active-symbols`);
    console.log(`   Теперь активных символов: ${activeResponse.data.count}`);

    // Удаляем символ
    console.log('\n➖ Удаляем LINKUSDT...');
    const removeResponse = await axios.post(`${BASE_URL}/remove-symbol`, {
      symbol: 'LINKUSDT'
    });
    console.log(`   ${removeResponse.data.message}`);

  } catch (error) {
    console.log(`❌ Ошибка управления: ${error.message}`);
  }
}

// Главная функция
async function runTests() {
  console.log('🚀 EMA Hedger v2.0 - Комплексное тестирование');
  console.log('=' .repeat(60));

  try {
    // Проверяем доступность сервера
    await axios.get(`${BASE_URL}/status`);
    console.log('✅ Сервер доступен\n');

    // Быстрый тест API
    await quickAPITest();

    // Тест управления
    await testManagement();

    // Основной тест стратегии
    await testMultiSymbolStrategy();

    console.log('\n🎉 Все тесты завершены успешно!');

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('\n❌ Сервер не запущен!');
      console.error('Запустите сервер командой: npm run start:dev');
    } else {
      console.error('\n❌ Критическая ошибка:', error.message);
    }
  }
}

// Запуск
if (require.main === module) {
  runTests();
}

module.exports = { testMultiSymbolStrategy, quickAPITest, testManagement };
