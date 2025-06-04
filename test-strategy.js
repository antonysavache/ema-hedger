// Простой тест стратегии через HTTP запросы
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Симуляция движения цены с пересечениями EMA
async function testStrategy() {
  console.log('🧪 Начинаем тест стратегии...\n');

  // Симулируем ситуацию:
  // 1. Цена пересекает EMA снизу вверх (должен открыться LONG)
  // 2. Цена идет вниз (усреднение + хедж)
  // 3. Цена снова пересекает EMA снизу вверх (закрытие шорта, новый лонг)
  // 4. Цена пересекает EMA сверху вниз (частичное закрытие лонгов + новый хедж)

  const priceMovement = [
    // Начальные цены ниже EMA для инициализации (50 свечей для расчета EMA)
    ...Array.from({length: 50}, (_, i) => 45 + i * 0.1), // 45.0 до 49.9
    
    // Пересечение снизу вверх - должен открыться LONG
    50.5, 51.0, 51.5,
    
    // Цена идет вниз - усреднение + хедж
    51.0, 50.5, 50.0, 49.5, 49.0, 48.5,
    
    // Снова вверх через EMA - закрытие шорта
    49.0, 49.5, 50.0, 50.5, 51.0, 51.5, 52.0,
    
    // Пересечение сверху вниз - частичное закрытие лонгов + хедж
    51.5, 51.0, 50.5, 50.0, 49.5, 49.0,
    
    // Восстановление
    49.5, 50.0, 50.5, 51.0, 52.0, 53.0, 54.0
  ];

  try {
    console.log('📊 Отправляем движение цены...');
    const response = await axios.post(`${BASE_URL}/simulate-price-movement`, {
      symbol: 'BTCUSDT',
      prices: priceMovement
    });

    console.log('\n🎯 Результат симуляции:');
    console.log(JSON.stringify(response.data, null, 2));

    // Получаем финальную статистику
    console.log('\n📈 Получаем финальную статистику...');
    const statsResponse = await axios.get(`${BASE_URL}/stats`);
    
    const statusResponse = await axios.get(`${BASE_URL}/status`);
    console.log('\n📋 Финальный статус стратегии:');
    console.log(JSON.stringify(statusResponse.data, null, 2));

  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Тест конкретного сценария
async function testSpecificScenario() {
  console.log('\n🎲 Тестируем конкретный сценарий...\n');
  
  const scenarios = [
    { 
      name: '📈 Пересечение EMA снизу вверх', 
      kline: {
        symbol: 'ETHUSDT',
        openTime: Date.now() - 1000,
        closeTime: Date.now(),
        open: '49.5',
        high: '50.5', 
        low: '49.5',
        close: '50.5',
        volume: '1000'
      }
    },
    {
      name: '📉 Пересечение EMA сверху вниз',
      kline: {
        symbol: 'ETHUSDT', 
        openTime: Date.now() - 1000,
        closeTime: Date.now(),
        open: '50.5',
        high: '50.5',
        low: '49.5', 
        close: '49.5',
        volume: '1000'
      }
    }
  ];

  try {
    for (const scenario of scenarios) {
      console.log(`\n${scenario.name}`);
      
      const response = await axios.post(`${BASE_URL}/process-kline`, scenario.kline);
      console.log(`✅ ${response.data.message} для ${response.data.symbol}`);
      
      // Небольшая задержка
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Получаем статус после сценариев
    const statusResponse = await axios.get(`${BASE_URL}/status`);
    console.log('\n📊 Статус после сценариев:');
    console.log(JSON.stringify(statusResponse.data.activePositions, null, 2));

  } catch (error) {
    console.error('❌ Ошибка в сценарии:', error.message);
  }
}

// Запуск тестов
async function runAllTests() {
  console.log('🚀 EMA Hedger Strategy - Комплексный тест\n');
  console.log('=' .repeat(60));
  
  try {
    // Проверяем, что сервер запущен
    await axios.get(`${BASE_URL}/status`);
    console.log('✅ Сервер доступен\n');
    
    // Запускаем основной тест
    await testStrategy();
    
    console.log('\n' + '='.repeat(60));
    
    // Запускаем тест сценариев  
    await testSpecificScenario();
    
    console.log('\n🎉 Все тесты завершены!');
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Сервер не запущен! Запустите: npm run start:dev');
    } else {
      console.error('❌ Ошибка при запуске тестов:', error.message);
    }
  }
}

// Запуск
if (require.main === module) {
  runAllTests();
}

module.exports = { testStrategy, testSpecificScenario, runAllTests };
