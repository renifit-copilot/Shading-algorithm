// Глобальные переменные
let shape = JSON.parse(JSON.stringify(ORIGINAL_SHAPE));
let fillColor = '#ff8c42'; // Цвет заливки по умолчанию
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
  ctx.strokeStyle = '#3a86ff';
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
  ctx.fillStyle = '#ff8c42';
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

// ==================== АЛГОРИТМ ЗАЛИВКИ С ЗАТРАВКОЙ ====================
async function seedFillAlgorithm() {
  if (!seedPoint || isFilling) return;
  isFilling = true;
  
  // Получаем данные пикселей Canvas
  const imageData = getCanvasPixelData();
  const pixelData = imageData.data;
  const width = canvas.width;
  const height = canvas.height;
  
  // Создаем двумерный массив для отслеживания посещений
  pixelVisited = new Array(height).fill(0).map(() => new Array(width).fill(false));
  
  // Конвертируем HEX-цвет в RGB
  const rgb = hexToRgb(fillColor);
  
  // Настраиваем цвет границы
  const borderColorThreshold = 100;
  
  try {
    // Запускаем рекурсивный алгоритм с затравкой
    // Для избежания переполнения стека используем асинхронный подход
    await fillPixel(Math.round(seedPoint.x), Math.round(seedPoint.y), rgb, pixelData, width, borderColorThreshold);
    
    // Обновляем изображение на холсте
    ctx.putImageData(imageData, 0, 0);
    
    // Перерисовываем контур, чтобы он не был закрашен
    drawShape(shape);
    
    showMessage('Заливка с затравкой выполнена!');
  } catch (e) {
    console.error('Ошибка при заливке:', e);
    showMessage('Ошибка при заливке!');
  } finally {
    isFilling = false;
  }
}

// Рекурсивная функция заливки пикселя
async function fillPixel(x, y, fillRgb, pixelData, width, borderColorThreshold) {
  // Проверяем границы холста
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
    return;
  }
  
  // Проверяем, был ли пиксель уже посещен
  if (pixelVisited[y][x]) {
    return;
  }
  
  // Вычисляем индекс пикселя в массиве данных
  const idx = (y * width + x) * 4;
  
  // Проверяем, является ли пиксель границей (достаточно темным)
  if (isBorderPixel(pixelData, idx, borderColorThreshold)) {
    return;
  }
  
  // Отмечаем пиксель как посещенный
  pixelVisited[y][x] = true;
  
  // Закрашиваем пиксель
  pixelData[idx] = fillRgb.r;
  pixelData[idx + 1] = fillRgb.g;
  pixelData[idx + 2] = fillRgb.b;
  pixelData[idx + 3] = 255; // Полная непрозрачность
  
  // Продолжаем заливку в 4 направлениях
  // Добавляем небольшую задержку, чтобы избежать переполнения стека
  if (x % 10 === 0 && y % 10 === 0) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  await fillPixel(x + 1, y, fillRgb, pixelData, width, borderColorThreshold);
  await fillPixel(x - 1, y, fillRgb, pixelData, width, borderColorThreshold);
  await fillPixel(x, y + 1, fillRgb, pixelData, width, borderColorThreshold);
  await fillPixel(x, y - 1, fillRgb, pixelData, width, borderColorThreshold);
}

// Проверка, является ли пиксель частью границы
function isBorderPixel(pixelData, idx, threshold) {
  // Проверяем, если пиксель достаточно темный (часть контура)
  const r = pixelData[idx];
  const g = pixelData[idx + 1];
  const b = pixelData[idx + 2];
  
  // Используем значение синего канала для определения границы
  // (наш контур синего цвета)
  return b > 150 && r < 100 && g < 100;
}

// ==================== АЛГОРИТМ ПОСТРОЧНОГО СКАНИРОВАНИЯ ====================
async function scanLineAlgorithm() {
  if (isFilling) return;
  isFilling = true;
  
  try {
    // Получаем границы фигуры для оптимизации
    const bounds = getShapeBounds(shape);
    
    // Получаем данные пикселей
    const imageData = getCanvasPixelData();
    const pixelData = imageData.data;
    const width = canvas.width;
    
    // Конвертируем HEX-цвет в RGB
    const rgb = hexToRgb(fillColor);
    
    // Проходим по каждой строке в пределах границ фигуры
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
      // Находим пересечения со строкой
      const intersections = findIntersections(shape, y);
      
      // Сортируем пересечения по x-координате
      intersections.sort((a, b) => a - b);
      
      // Заполняем пиксели между парами пересечений
      for (let i = 0; i < intersections.length; i += 2) {
        if (i + 1 < intersections.length) {
          const startX = Math.ceil(intersections[i]);
          const endX = Math.floor(intersections[i + 1]);
          
          // Закрашиваем пиксели на этой строке
          for (let x = startX; x <= endX; x++) {
            const idx = (y * width + x) * 4;
            pixelData[idx] = rgb.r;
            pixelData[idx + 1] = rgb.g;
            pixelData[idx + 2] = rgb.b;
            pixelData[idx + 3] = 255; // Полная непрозрачность
          }
        }
      }
      
      // Периодически обновляем отображение и добавляем задержку
      // для визуализации процесса
      if (y % 10 === 0) {
        ctx.putImageData(imageData, 0, 0);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    // Обновляем изображение на холсте
    ctx.putImageData(imageData, 0, 0);
    
    // Перерисовываем контур, чтобы он не был закрашен
    drawShape(shape);
    
    showMessage('Построчное сканирование выполнено!');
  } catch (e) {
    console.error('Ошибка при сканировании:', e);
    showMessage('Ошибка при сканировании!');
  } finally {
    isFilling = false;
  }
}

// Находим пересечения строки сканирования с ребрами многоугольника
function findIntersections(shapeCoords, y) {
  const intersections = [];
  
  // Проходим по всем ребрам многоугольника
  for (let i = 0, j = shapeCoords.length - 1; i < shapeCoords.length; j = i++) {
    const y1 = shapeCoords[j][1];
    const y2 = shapeCoords[i][1];
    
    // Проверяем, пересекает ли строка сканирования ребро
    if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
      const x1 = shapeCoords[j][0];
      const x2 = shapeCoords[i][0];
      
      // Вычисляем x-координату пересечения по формуле прямой
      const x = x1 + (y - y1) * (x2 - x1) / (y2 - y1);
      intersections.push(x);
    }
  }
  
  return intersections;
}

// Получаем границы фигуры для оптимизации
function getShapeBounds(shapeCoords) {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  shapeCoords.forEach(([x, y]) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  });
  
  return { minX, minY, maxX, maxY };
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