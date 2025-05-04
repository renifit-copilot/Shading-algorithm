// Инициализация canvas
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Конфигурация
const CONFIG = {
	canvas: {
		width: 600,
		height: 600,
		center: [300, 300]
	},
	colors: {
		border: 'blue',
		background: 'white'
	}
};

// Начальные координаты бабочки
const ORIGINAL_SHAPE = [
	[350, 200], // верхняя середина
	[250, 150], // левая верхняя точка
	[300, 250], // нижняя левая точка
	[350, 220], // нижняя середина
	[400, 250], // правая нижняя точка
	[450, 150]  // правая верхняя точка
];

/**
 * Класс для управления приложением закраски
 */
class FillApp {
	/**
	 * Создает экземпляр приложения закраски
	 * Инициализирует состояние, обработчики событий и отрисовывает фигуру
	 */
	constructor() {
		// Инициализация состояния
		this.shape = JSON.parse(JSON.stringify(ORIGINAL_SHAPE)); // Клонирование фигуры
		this.isDrawingMode = false;
		this.currentFillColor = document.getElementById('fillColor').value;
		this.currentBorderColor = document.getElementById('borderColor').value;
		
		// Инициализация обработчиков событий
		this.initEventHandlers();
		
		// Первоначальная отрисовка
		this.drawShape();
	}

	/**
	 * Инициализация обработчиков событий для кнопок и элементов управления
	 */
	initEventHandlers() {
		// Обработчик изменения цвета заливки
		document.getElementById('fillColor').addEventListener('input', (e) => {
			this.currentFillColor = e.target.value;
		});
		
		// Обработчик изменения цвета контура
		document.getElementById('borderColor').addEventListener('input', (e) => {
			this.currentBorderColor = e.target.value;
			// Перерисовываем фигуру при изменении цвета контура
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			this.drawShape();
		});
		
		// Обработчик заливки с затравкой
		document.getElementById('seedFill').addEventListener('click', () => {
			this.isDrawingMode = true;
			canvas.style.cursor = 'crosshair';
		});
		
		// Обработчик клика по холсту для заливки
		canvas.addEventListener('click', (e) => {
			if (!this.isDrawingMode) return;
			
			const rect = canvas.getBoundingClientRect();
			const x = Math.floor(e.clientX - rect.left);
			const y = Math.floor(e.clientY - rect.top);
			
			this.seedFill(x, y, this.currentFillColor);
			this.isDrawingMode = false;
			canvas.style.cursor = 'default';
		});
		
		// Обработчик построчного сканирования
		document.getElementById('scanlineFill').addEventListener('click', () => {
			this.scanlineFill(this.currentFillColor);
		});
		
		// Обработчик сброса
		document.getElementById('reset').addEventListener('click', () => {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			this.drawShape();
		});
	}
	
	/**
	 * Отрисовка фигуры на холсте с текущим цветом контура
	 */
	drawShape() {
		ctx.beginPath();
		ctx.strokeStyle = this.currentBorderColor;
		ctx.lineWidth = 2;
		
		ctx.moveTo(...this.shape[0]);
		for (let i = 1; i < this.shape.length; i++) {
			ctx.lineTo(...this.shape[i]);
		}
		
		ctx.lineTo(...this.shape[0]);
		
		ctx.stroke();
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
	isSimilarColor(r1, g1, b1, r2, g2, b2, tolerance = 10) {
		return Math.abs(r1 - r2) <= tolerance &&
			Math.abs(g1 - g2) <= tolerance &&
			Math.abs(b1 - b2) <= tolerance;
	}
	
	/**
	 * Алгоритм заливки с затравкой
	 * @param {number} startX - X-координата начальной точки (затравки)
	 * @param {number} startY - Y-координата начальной точки (затравки)
	 * @param {string} fillColor - Цвет заливки в HEX-формате (#RRGGBB)
	 */
	seedFill(startX, startY, fillColor) {
		// Получаем данные изображения БЕЗ очистки холста
		const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
		const pixels = imageData.data;
		
		/**
		 * Преобразует HEX-цвет в массив RGB компонентов
		 * @param {string} hex - Цвет в HEX-формате (#RRGGBB)
		 * @returns {Array<number>} Массив [r, g, b] компонентов цвета
		 */
		const hexToRgb = (hex) => {
			const r = parseInt(hex.slice(1, 3), 16);
			const g = parseInt(hex.slice(3, 5), 16);
			const b = parseInt(hex.slice(5, 7), 16);
			return [r, g, b];
		};
		
		const [fillR, fillG, fillB] = hexToRgb(fillColor);
		
		// Получаем цвет начальной точки (затравки)
		const idx = (startY * canvas.width + startX) * 4;
		const targetR = pixels[idx];
		const targetG = pixels[idx + 1];
		const targetB = pixels[idx + 2];
		
		// Проверяем, не пытаемся ли мы закрасить уже закрашенную область
		if (this.isSimilarColor(targetR, targetG, targetB, fillR, fillG, fillB)) {
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
			const i = (y * canvas.width + x) * 4;
			return this.isSimilarColor(
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
			const i = (y * canvas.width + x) * 4;
			return this.isSimilarColor(
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
			const i = (y * canvas.width + x) * 4;
			pixels[i] = fillR;
			pixels[i + 1] = fillG;
			pixels[i + 2] = fillB;
			pixels[i + 3] = 255; // Полная непрозрачность
		};
		
		// Алгоритм заливки
		while (stack.length > 0) {
			const [x, y] = stack.pop();
			
			// Пропускаем, если вышли за границы
			if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
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
		ctx.putImageData(imageData, 0, 0);
		
		// Перерисовываем только контур
		this.drawShape();
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
		const tempCanvas = document.createElement('canvas');
		tempCanvas.width = canvas.width;
		tempCanvas.height = canvas.height;
		const tempCtx = tempCanvas.getContext('2d');
		
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
		const tempImageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
		const tempPixels = tempImageData.data;
		
		/**
		 * Преобразует HEX-цвет в массив RGB компонентов
		 * @param {string} hex - Цвет в HEX-формате (#RRGGBB)
		 * @returns {Array<number>} Массив [r, g, b] компонентов цвета
		 */
		const hexToRgb = (hex) => {
			const r = parseInt(hex.slice(1, 3), 16);
			const g = parseInt(hex.slice(3, 5), 16);
			const b = parseInt(hex.slice(5, 7), 16);
			return [r, g, b];
		};
		
		const [borderR, borderG, borderB] = hexToRgb(this.currentBorderColor);
		
		/**
		 * Проверяет, является ли пиксель границей
		 * @param {number} x - X-координата пикселя
		 * @param {number} y - Y-координата пикселя
		 * @returns {boolean} true, если пиксель является границей
		 */
		const isBorderPixel = (x, y) => {
			const idx = (y * canvas.width + x) * 4;
			// Проверяем, соответствует ли цвет пикселя текущему цвету границы
			return this.isSimilarColor(
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
		const fillImageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
		const fillPixels = fillImageData.data;
		
		// Получаем данные текущего холста
		const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
		const currentPixels = currentImageData.data;
		
		const [fillR, fillG, fillB] = hexToRgb(fillColor);
		
		// Объединяем изображения
		for (let y = minY; y <= maxY; y++) {
			for (let x = minX; x <= maxX; x++) {
				const idx = (y * canvas.width + x) * 4;
				
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
		ctx.putImageData(currentImageData, 0, 0);
		
		
		// Перерисовываем контур
		this.drawShape();
	}
}

// Инициализация приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
	new FillApp();
}); 