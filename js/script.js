/**
 * Объединенный JS файл со всей логикой приложения закраски
 */

// =================== ОСНОВНЫЕ ФУНКЦИИ ===================

/**
 * Преобразует HEX-цвет в массив RGB компонентов
 * @param {string} hex - Цвет в HEX-формате (#RRGGBB)
 * @returns {Array<number>} Массив [r, g, b] компонентов цвета
 */
function hexToRgb(hex) {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	return [r, g, b];
}

/**
 * Проверка, является ли цвет пикселя примерно равным другому цвету
 * @param {number} r1 - Красный компонент первого цвета
 * @param {number} g1 - Зеленый компонент первого цвета
 * @param {number} b1 - Синий компонент первого цвета
 * @param {number} r2 - Красный компонент второго цвета
 * @param {number} g2 - Зеленый компонент второго цвета
 * @param {number} b2 - Синий компонент второго цвета
 * @param {number} [tolerance=10] - Допустимое отклонение для каждого компонента
 * @returns {boolean} Результат сравнения цветов
 */
function isSimilarColor(r1, g1, b1, r2, g2, b2, tolerance = 10) {
	return Math.abs(r1 - r2) <= tolerance &&
		Math.abs(g1 - g2) <= tolerance &&
		Math.abs(b1 - b2) <= tolerance;
}

// =================== КОНФИГУРАЦИЯ ===================

/**
 * Конфигурация приложения
 */
const CONFIG = {
	canvas: {
		width: 600,
		height: 400,
		center: [300, 200]
	},
	colors: {
		border: '#0000ff',
		fill: '#ff0000',
		background: 'white'
	}
};

/**
 * Начальные координаты фигуры в форме бабочки
 */
const ORIGINAL_SHAPE = [
	[350, 200], // верхняя середина
	[250, 150], // левая верхняя точка
	[300, 250], // нижняя левая точка
	[350, 220], // нижняя середина
	[400, 250], // правая нижняя точка
	[450, 150]  // правая верхняя точка
];

// =================== CANVAS ===================

/**
 * Класс для управления холстом
 */
class CanvasManager {
	/**
	 * @param {HTMLCanvasElement} canvas - DOM элемент холста
	 */
	constructor(canvas) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this.setupCanvas();
	}

	/**
	 * Настройка холста
	 */
	setupCanvas() {
		// Устанавливаем размеры холста из конфигурации
		this.canvas.width = CONFIG.canvas.width;
		this.canvas.height = CONFIG.canvas.height;
	}

	/**
	 * Очистка холста
	 */
	clearCanvas() {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
	}

	/**
	 * Отрисовка фигуры на холсте с заданным цветом контура
	 * @param {Array<Array<number>>} shape - Массив точек фигуры [[x1, y1], [x2, y2], ...]
	 * @param {string} borderColor - Цвет контура в HEX-формате
	 */
	drawShape(shape, borderColor) {
		this.ctx.beginPath();
		this.ctx.strokeStyle = borderColor;
		this.ctx.lineWidth = 2;
		
		this.ctx.moveTo(...shape[0]);
		for (let i = 1; i < shape.length; i++) {
			this.ctx.lineTo(...shape[i]);
		}
		
		this.ctx.lineTo(...shape[0]);
		
		this.ctx.stroke();
	}

	/**
	 * Получение данных изображения
	 * @returns {ImageData} Данные изображения
	 */
	getImageData() {
		return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
	}

	/**
	 * Установка данных изображения
	 * @param {ImageData} imageData - Данные изображения
	 */
	putImageData(imageData) {
		this.ctx.putImageData(imageData, 0, 0);
	}

	/**
	 * Создание временного холста с тем же размером
	 * @returns {Object} Объект с временным холстом и его контекстом
	 */
	createTempCanvas() {
		const tempCanvas = document.createElement('canvas');
		tempCanvas.width = this.canvas.width;
		tempCanvas.height = this.canvas.height;
		const tempCtx = tempCanvas.getContext('2d');
		return { tempCanvas, tempCtx };
	}
}

// =================== ОСНОВНОЙ КОД ПРИЛОЖЕНИЯ ===================

/**
 * Основной класс приложения закраски
 */
class FillApp {
	/**
	 * Создает экземпляр приложения закраски
	 */
	constructor() {
		// Инициализация DOM элементов
		this.canvas = document.getElementById('canvas');
		this.fillColorInput = document.getElementById('fillColor');
		this.borderColorInput = document.getElementById('borderColor');
		this.seedFillBtn = document.getElementById('seedFill');
		this.scanlineFillBtn = document.getElementById('scanlineFill');
		this.resetBtn = document.getElementById('reset');
		
		// Инициализация холста
		this.canvasManager = new CanvasManager(this.canvas);
		
		// Инициализация состояния
		this.shape = JSON.parse(JSON.stringify(ORIGINAL_SHAPE)); // Клонирование фигуры
		this.isDrawingMode = false;
		this.currentFillColor = this.fillColorInput.value;
		this.currentBorderColor = this.borderColorInput.value;
		
		// Инициализация обработчиков событий
		this.initEventHandlers();
		
		// Первоначальная отрисовка
		this.redraw();
	}

	/**
	 * Инициализация обработчиков событий для кнопок и элементов управления
	 */
	initEventHandlers() {
		// Обработчик изменения цвета заливки
		this.fillColorInput.addEventListener('input', (e) => {
			this.currentFillColor = e.target.value;
		});
		
		// Обработчик изменения цвета контура
		this.borderColorInput.addEventListener('input', (e) => {
			this.currentBorderColor = e.target.value;
			// Перерисовываем фигуру при изменении цвета контура
			this.redraw();
		});
		
		// Обработчик заливки с затравкой
		this.seedFillBtn.addEventListener('click', () => {
			this.isDrawingMode = true;
			this.canvas.style.cursor = 'crosshair';
		});
		
		// Обработчик клика по холсту для заливки
		this.canvas.addEventListener('click', (e) => {
			if (!this.isDrawingMode) return;
			
			const rect = this.canvas.getBoundingClientRect();
			const x = Math.floor(e.clientX - rect.left);
			const y = Math.floor(e.clientY - rect.top);
			
			this.seedFill(x, y, this.currentFillColor);
			this.isDrawingMode = false;
			this.canvas.style.cursor = 'default';
		});
		
		// Обработчик построчного сканирования
		this.scanlineFillBtn.addEventListener('click', () => {
			this.scanlineFill(this.currentFillColor);
		});
		
		// Обработчик сброса
		this.resetBtn.addEventListener('click', () => {
			this.redraw();
		});
	}
	
	/**
	 * Перерисовка содержимого холста
	 */
	redraw() {
		this.canvasManager.clearCanvas();
		this.canvasManager.drawShape(this.shape, this.currentBorderColor);
	}
	
	/**
	 * Алгоритм заливки с затравкой
	 * @param {number} startX - X-координата начальной точки (затравки)
	 * @param {number} startY - Y-координата начальной точки (затравки)
	 * @param {string} fillColor - Цвет заливки в HEX-формате (#RRGGBB)
	 */
	seedFill(startX, startY, fillColor) {
		// Получаем данные изображения БЕЗ очистки холста
		const imageData = this.canvasManager.getImageData();
		const pixels = imageData.data;
		
		const [fillR, fillG, fillB] = hexToRgb(fillColor);
		
		// Получаем цвет начальной точки (затравки)
		const idx = (startY * this.canvas.width + startX) * 4;
		const targetR = pixels[idx];
		const targetG = pixels[idx + 1];
		const targetB = pixels[idx + 2];
		
		// Проверяем, не пытаемся ли мы закрасить уже закрашенную область
		if (isSimilarColor(targetR, targetG, targetB, fillR, fillG, fillB)) {
			return; // Область уже закрашена тем же цветом
		}
		
		// Получаем цвет границы
		const [borderR, borderG, borderB] = hexToRgb(this.currentBorderColor);
		
		// Стек для алгоритма
		const stack = [[startX, startY]];
		
		/**
		 * Проверяет, соответствует ли цвет пикселя целевому цвету
		 * @param {number} x - X-координата пикселя
		 * @param {number} y - Y-координата пикселя
		 * @returns {boolean} true, если цвет пикселя соответствует целевому
		 */
		const isTargetColor = (x, y) => {
			const i = (y * this.canvas.width + x) * 4;
			return isSimilarColor(
				pixels[i], pixels[i + 1], pixels[i + 2],
				targetR, targetG, targetB
			);
		};
		
		/**
		 * Проверяет, является ли пиксель границей
		 * @param {number} x - X-координата пикселя
		 * @param {number} y - Y-координата пикселя
		 * @returns {boolean} true, если пиксель является границей
		 */
		const isBorderColor = (x, y) => {
			const i = (y * this.canvas.width + x) * 4;
			return isSimilarColor(
				pixels[i], pixels[i + 1], pixels[i + 2],
				borderR, borderG, borderB
			);
		};
		
		/**
		 * Закрашивает пиксель выбранным цветом
		 * @param {number} x - X-координата пикселя
		 * @param {number} y - Y-координата пикселя
		 */
		const setPixel = (x, y) => {
			const i = (y * this.canvas.width + x) * 4;
			pixels[i] = fillR;
			pixels[i + 1] = fillG;
			pixels[i + 2] = fillB;
			pixels[i + 3] = 255; // Полная непрозрачность
		};
		
		// Алгоритм заливки
		while (stack.length > 0) {
			const [x, y] = stack.pop();
			
			// Пропускаем, если вышли за границы
			if (x < 0 || x >= this.canvas.width || y < 0 || y >= this.canvas.height) {
				continue;
			}
			
			// Пропускаем, если пиксель уже нужного цвета или это граница
			if (!isTargetColor(x, y) || isBorderColor(x, y)) {
				continue;
			}
			
			// Закрашиваем пиксель
			setPixel(x, y);
			
			// Добавляем соседей в стек
			stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
		}
		
		// Обновляем изображение
		this.canvasManager.putImageData(imageData);
		
		// Перерисовываем только контур для четкости
		this.canvasManager.drawShape(this.shape, this.currentBorderColor);
	}
	
	/**
	 * Алгоритм построчного сканирования
	 * @param {string} fillColor - Цвет заливки в HEX-формате (#RRGGBB)
	 */
	scanlineFill(fillColor) {
		// Получаем границы фигуры для оптимизации
		const minX = Math.min(...this.shape.map(p => p[0])) - 1;
		const maxX = Math.max(...this.shape.map(p => p[0])) + 1;
		const minY = Math.min(...this.shape.map(p => p[1])) - 1;
		const maxY = Math.max(...this.shape.map(p => p[1])) + 1;
		
		// Создаем временный холст для отрисовки только новой заливки
		const { tempCanvas, tempCtx } = this.canvasManager.createTempCanvas();
		
		// Рисуем контур на временном холсте
		tempCtx.beginPath();
		tempCtx.strokeStyle = this.currentBorderColor;
		tempCtx.lineWidth = 2;
		tempCtx.moveTo(...this.shape[0]);
		for (let i = 1; i < this.shape.length; i++) {
			tempCtx.lineTo(...this.shape[i]);
		}
		tempCtx.lineTo(...this.shape[0]);
		tempCtx.stroke();
		
		// Получаем данные изображения временного холста
		const tempImageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
		const tempPixels = tempImageData.data;
		
		const [borderR, borderG, borderB] = hexToRgb(this.currentBorderColor);
		
		/**
		 * Проверяет, является ли пиксель границей
		 * @param {number} x - X-координата пикселя
		 * @param {number} y - Y-координата пикселя
		 * @returns {boolean} true, если пиксель является границей
		 */
		const isBorderPixel = (x, y) => {
			const idx = (y * tempCanvas.width + x) * 4;
			// Проверяем, соответствует ли цвет пикселя текущему цвету границы
			return isSimilarColor(
				tempPixels[idx], tempPixels[idx + 1], tempPixels[idx + 2],
				borderR, borderG, borderB
			);
		};
		
		// Проходим по всей области фигуры
		tempCtx.fillStyle = fillColor;
		
		for (let y = minY; y <= maxY; y++) {
			const intersections = [];
			
			// Находим пересечения с отрезками
			for (let i = 0; i < this.shape.length; i++) {
				const [x1, y1] = this.shape[i];
				const [x2, y2] = this.shape[(i + 1) % this.shape.length]; // Используем замкнутый контур
				
				// Проверяем, пересекает ли горизонтальная линия отрезок
				if ((y1 <= y && y < y2) || (y2 <= y && y < y1)) {
					// Вычисляем x-координату пересечения
					const x = x1 + (y - y1) * (x2 - x1) / (y2 - y1);
					intersections.push(x);
				}
			}
			
			// Сортируем пересечения по x
			intersections.sort((a, b) => a - b);
			
			// Заливаем между парами пересечений на временном холсте
			for (let i = 0; i < intersections.length; i += 2) {
				if (i + 1 < intersections.length) {
					const startX = Math.ceil(intersections[i]);
					const endX = Math.floor(intersections[i + 1]);
					
					if (startX <= endX) {
						tempCtx.fillRect(startX, y, endX - startX + 1, 1);
					}
				}
			}
		}
		
		// Получаем данные изображения с заливкой
		const fillImageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
		const fillPixels = fillImageData.data;
		
		// Получаем данные текущего холста
		const currentImageData = this.canvasManager.getImageData();
		const currentPixels = currentImageData.data;
		
		const [fillR, fillG, fillB] = hexToRgb(fillColor);
		
		// Объединяем изображения
		for (let y = minY; y <= maxY; y++) {
			for (let x = minX; x <= maxX; x++) {
				const idx = (y * this.canvas.width + x) * 4;
				
				// Если пиксель закрашен на временном холсте и не является границей
				if (!isBorderPixel(x, y) && fillPixels[idx + 3] > 0) {
					currentPixels[idx] = fillR;
					currentPixels[idx + 1] = fillG;
					currentPixels[idx + 2] = fillB;
					currentPixels[idx + 3] = 255;
				}
			}
		}
		
		// Обновляем основной холст
		this.canvasManager.putImageData(currentImageData);
		
		// Перерисовываем контур для четкости
		this.canvasManager.drawShape(this.shape, this.currentBorderColor);
	}
}

// Инициализация приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
	new FillApp();
}); 