// Быстрый тест для проверки логирования
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function quickTest() {
  console.log('🧪 Быстрый тест детального логирования\n');

  try {
    // Отправляем простое движение цены для тестирования
    console.log('📊 Отправляем движение цены...');
    
    const testPrices = [
      // Инициализация EMA (50 свечей)
      ...Array.from({length: 50}, (_, i) => 45 + i * 0.1),
      
      // Пересечение снизу вверх (должно открыть лонг)
      50.5,
      
      // Падение (должно усреднить и создать хедж)
      49.5, 48.5,
      
      // Снова вверх (должно закрыть шорт)
      50.5,
      
      // Пересечение сверху вниз (должно частично закрыть лонги и создать хедж)
      49.0
    ];

    const response = await axios.post(`${BASE_URL}/simulate-price-movement`, {
      symbol: 'TESTUSDT',
      prices: testPrices
    });

    console.log('\n✅ Симуляция завершена!');
    console.log('\n📊 Проверяем статистику...');
    
    await axios.get(`${BASE_URL}/stats`);
    
    console.log('\n🎉 Проверьте логи выше для детального отслеживания всех действий!');

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Сервер не запущен! Запустите в другом терминале: npm run start:dev');
    } else {
      console.error('❌ Ошибка:', error.message);
    }
  }
}

quickTest();
