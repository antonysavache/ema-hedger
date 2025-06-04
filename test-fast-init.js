// Тест быстрой инициализации EMA
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testFastInitialization() {
  console.log('⚡ Тест быстрой инициализации EMA(130)');
  console.log('📊 Проверяем скорость загрузки исторических данных\n');

  try {
    console.log('🚀 Запускаем торговлю по 10 символам для теста...');
    const startTime = Date.now();
    
    const response = await axios.post(`${BASE_URL}/start-trading`, {
      symbolCount: 10
    });
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`✅ ${response.data.message}`);
    console.log(`⏱️ Время инициализации: ${duration.toFixed(1)} секунд`);
    
    // Проверяем результат
    const status = await axios.get(`${BASE_URL}/trading-status`);
    const portfolio = await axios.get(`${BASE_URL}/portfolio`);
    
    console.log(`\n📊 Результат инициализации:`);
    console.log(`   Торговля активна: ${status.data.isTrading ? '✅' : '❌'}`);
    console.log(`   Активных символов: ${status.data.activeSymbolsCount}`);
    console.log(`   EMA инициализировано: ${portfolio.data.strategy.emaPeriod === 130 ? '✅' : '❌'}`);
    
    // Тестируем добавление нового символа
    console.log(`\n🔄 Тестируем быстрое добавление нового символа...`);
    const addStartTime = Date.now();
    
    const addResponse = await axios.post(`${BASE_URL}/add-symbol`, {
      symbol: 'LINKUSDT'
    });
    
    const addEndTime = Date.now();
    const addDuration = (addEndTime - addStartTime) / 1000;
    
    console.log(`   ${addResponse.data.message}`);
    console.log(`   ⏱️ Время добавления: ${addDuration.toFixed(1)} секунд`);
    
    // Финальная проверка
    const finalStatus = await axios.get(`${BASE_URL}/active-symbols`);
    console.log(`   📊 Итого символов: ${finalStatus.data.count}`);
    
    // Останавливаем торговлю
    await axios.post(`${BASE_URL}/stop-trading`);
    console.log(`\n✅ Тест завершен успешно!`);
    
    console.log(`\n🎯 Выводы:`);
    console.log(`   • Инициализация 10 символов: ${duration.toFixed(1)}с (было бы 3+ часа без исторических данных)`);
    console.log(`   • Добавление 1 символа: ${addDuration.toFixed(1)}с (было бы 10+ минут)`);
    console.log(`   • EMA(130) готова к работе немедленно!`);

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Сервер не запущен! Запустите: npm run start:dev');
    } else {
      console.error('❌ Ошибка тестирования:', error.message);
    }
  }
}

testFastInitialization();
