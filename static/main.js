// Глобальные переменные
let shape = JSON.parse(JSON.stringify(ORIGINAL_SHAPE));
let fillColor = '#ff8c42'; // Цвет заливки по умолчанию
let boundaryColor = '#3a86ff'; // Цвет контура по умолчанию
let isFilling = false; // Флаг для отслеживания процесса заливки
let seedPoint = null; // Точка затравки для алгоритма заливки
let canvasData = null; // Данные пикселей с холста
let currentFillMode = 'seed-fill'; // Текущий режим заливки
let pixelVisited = []; // Массив для отслеживания посещенных пикселей

// Константы для Canvas
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const infoMessage = document.createElement('div');
infoMessage.className = 'info-message';

// Настройка холста
function setupCanvas() {
  // Высокое разрешение для ретина-дисплеев
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  
  ctx.scale(dpr, dpr);
  
  // Сбрасываем CSS размеры
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  
  // Добавляем информационное сообщение
  const canvasWrapper = document.querySelector('.canvas-wrapper');
  canvasWrapper.appendChild(infoMessage);
}

// Отображение информационного сообщения
function showMessage(text, duration = 2000) {
  infoMessage.textContent = text;
  infoMessage.classList.add('visible');
  
  setTimeout(() => {
    infoMessage.classList.remove('visible');
  }, duration);
}

// Функция отрисовки контура
function drawShape(shapeCoords = shape) {
  // Очистка холста
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Отрисовка сетки координат (опционально)
  drawGrid();
  
  // Отрисовка контура фигуры
  ctx.beginPath();
  shapeCoords.forEach(([x, y], i) => {
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  
  // Стиль для контура
  ctx.strokeStyle = boundaryColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Отрисовка точек контура
  shapeCoords.forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffbe0b';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();
  });
  
  // Отрисовка затравочной точки, если она выбрана
  if (seedPoint) {
    drawSeedPoint(seedPoint.x, seedPoint.y);
  }
}

// Отрисовка точки затравки
function drawSeedPoint(x, y) {
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// Отрисовка сетки
function drawGrid() {
  const gridSize = 50;
  const width = canvas.width;
  const height = canvas.height;
  
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 0.5;
  
  // Вертикальные линии
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  
  // Горизонтальные линии
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

// Проверка, находится ли точка внутри многоугольника
function isPointInShape(x, y, shapeCoords = shape) {
  let inside = false;
  
  for (let i = 0, j = shapeCoords.length - 1; i < shapeCoords.length; j = i++) {
    const xi = shapeCoords[i][0], yi = shapeCoords[i][1];
    const xj = shapeCoords[j][0], yj = shapeCoords[j][1];
    
    const intersect = ((yi > y) !== (yj > y)) && 
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }
  
  return inside;
}

// Получение данных о пикселях с холста
function getCanvasPixelData() {
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

// Обработчик события клика по холсту
function handleCanvasClick(e) {
  if (isFilling) return;
  
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  if (currentFillMode === 'seed-fill') {
    // Проверяем, находится ли точка внутри фигуры
    if (isPointInShape(x, y)) {
      seedPoint = { x, y };
      drawShape(); // Перерисовываем с точкой затравки
      document.getElementById('apply-seed-fill').disabled = false;
      showMessage('Точка затравки выбрана!');
    } else {
      showMessage('Выберите точку внутри фигуры!', 3000);
    }
  }
}

// Отправка запроса на API
async function sendFillRequest(algorithm, params = {}) {
  try {
    console.log('Отправка запроса:', { algorithm, ...params });
    
    const response = await fetch('/api/fill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shape: shape,
        fill_color: fillColor,
        boundary_color: boundaryColor,
        algorithm: algorithm,
        ...params
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ошибка сервера:', errorText);
      throw new Error(`Ошибка при запросе к серверу: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Получен ответ:', data);
    return data;
  } catch (error) {
    console.error('Ошибка при отправке запроса:', error);
    showMessage('Ошибка при отправке запроса!');
    return null;
  }
}

// Отрисовка изображения, полученного с сервера
function drawServerImage(imageData) {
  try {
    // Получаем данные о размерах изображения и цветовую карту
    const image = imageData.image;
    const colorMap = imageData.color_map;
    const width = imageData.width;
    const height = imageData.height;
    
    console.log(`Рисуем изображение ${width}x${height}, карта цветов:`, colorMap);
    
    // Создаем ImageData для Canvas
    const canvasImageData = ctx.createImageData(width, height);
    const canvasPixels = canvasImageData.data;
    
    // Проходим по всем пикселям изображения и заполняем canvasPixels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = (y * width + x) * 4;
        const colorIndex = image[y][x].toString();  // Преобразуем индекс в строку для доступа к карте
        
        // Получаем цвет из цветовой карты
        let color = colorMap[colorIndex];
        
        if (color === "transparent") {
          // Прозрачный пиксель
          canvasPixels[pixelIndex] = 255;
          canvasPixels[pixelIndex + 1] = 255;
          canvasPixels[pixelIndex + 2] = 255;
          canvasPixels[pixelIndex + 3] = 0; // Прозрачный
        } else {
          // Преобразуем HEX в RGB
          const rgb = hexToRgb(color);
          canvasPixels[pixelIndex] = rgb.r;
          canvasPixels[pixelIndex + 1] = rgb.g;
          canvasPixels[pixelIndex + 2] = rgb.b;
          canvasPixels[pixelIndex + 3] = 255; // Непрозрачный
        }
      }
    }
    
    // Рисуем изображение на холсте
    ctx.putImageData(canvasImageData, 0, 0);
    
    // Перерисовываем точки контура для наглядности
    shape.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffbe0b';
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    
    // Отрисовка затравочной точки, если она выбрана
    if (seedPoint) {
      drawSeedPoint(seedPoint.x, seedPoint.y);
    }
  } catch (error) {
    console.error('Ошибка при отрисовке изображения:', error);
    showMessage('Ошибка при отрисовке!');
  }
}

// ==================== АЛГОРИТМ ЗАЛИВКИ С ЗАТРАВКОЙ ====================
async function seedFillAlgorithm() {
  if (!seedPoint || isFilling) return;
  isFilling = true;
  
  try {
    showMessage('Выполняем заливку...', 1000);
    
    // Отправляем запрос на сервер с точкой затравки
    const response = await sendFillRequest('flood_fill', { seed_point: seedPoint });
    
    if (response) {
      // Рисуем полученное с сервера изображение
      drawServerImage(response);
      showMessage('Заливка с затравкой выполнена!');
    }
  } catch (e) {
    console.error('Ошибка при заливке:', e);
    showMessage('Ошибка при заливке!');
  } finally {
    isFilling = false;
  }
}

// ==================== АЛГОРИТМ ПОСТРОЧНОГО СКАНИРОВАНИЯ ====================
async function scanLineAlgorithm() {
  if (isFilling) return;
  isFilling = true;
  
  try {
    showMessage('Выполняем построчное сканирование...', 1000);
    
    // Отправляем запрос на сервер
    const response = await sendFillRequest('scanline');
    
    if (response) {
      // Рисуем полученное с сервера изображение
      drawServerImage(response);
      showMessage('Построчное сканирование выполнено!');
    }
  } catch (e) {
    console.error('Ошибка при сканировании:', e);
    showMessage('Ошибка при сканировании!');
  } finally {
    isFilling = false;
  }
}

// Конвертация HEX-цвета в RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

// Инициализация всех обработчиков событий
function initEventHandlers() {
  // Обработчик выбора точки затравки
  canvas.addEventListener('click', handleCanvasClick);
  
  // Обработчик изменения цвета заливки
  document.getElementById('fill-color').addEventListener('input', (e) => {
    fillColor = e.target.value;
    if (seedPoint) {
      drawShape(); // Перерисовываем с учетом новой точки затравки
    }
  });
  
  // Обработчик изменения цвета контура
  document.getElementById('boundary-color').addEventListener('input', (e) => {
    boundaryColor = e.target.value;
    drawShape(); // Перерисовываем с новым цветом контура
  });
  
  // Обработчик кнопки заливки с затравкой
  document.getElementById('apply-seed-fill').addEventListener('click', () => {
    seedFillAlgorithm();
  });
  
  // Обработчик кнопки построчного сканирования
  document.getElementById('apply-scan-line').addEventListener('click', () => {
    scanLineAlgorithm();
  });
  
  // Обработчик сброса фигуры
  document.getElementById('reset').addEventListener('click', () => {
    seedPoint = null;
    document.getElementById('apply-seed-fill').disabled = true;
    drawShape();
    showMessage('Фигура сброшена!');
  });
  
  // Обработчик изменения размера окна
  window.addEventListener('resize', () => {
    setupCanvas();
    drawShape();
  });
}

// Инициализация приложения
function init() {
  setupCanvas();
  initEventHandlers();
  drawShape();
  showMessage('Выберите точку внутри фигуры для заливки', 3000);
}

// Запуск приложения
init(); 