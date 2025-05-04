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
const points = [
	[350, 200], // верхняя середина
	[250, 150], // левая верхняя точка
	[300, 250], // нижняя левая точка
	[350, 220], // нижняя середина
	[400, 250], // правая нижняя точка
	[450, 150]  // правая верхняя точка
];

// Состояние приложения
let isDrawingMode = false;
let currentFillColor = document.getElementById('fillColor').value;

// Отрисовка фигуры
function drawFigure() {
	ctx.beginPath();
	ctx.strokeStyle = CONFIG.colors.border;
	ctx.lineWidth = 2;

	ctx.moveTo(...points[0]);
	for (let i = 1; i < points.length; i++) {
		ctx.lineTo(...points[i]);
	}

	ctx.lineTo(...points[0]);

	ctx.stroke();
}

// Проверка, является ли цвет пикселя примерно равным другому цвету
function isSimilarColor(r1, g1, b1, r2, g2, b2, tolerance = 10) {
	return Math.abs(r1 - r2) <= tolerance &&
		Math.abs(g1 - g2) <= tolerance &&
		Math.abs(b1 - b2) <= tolerance;
}

// Алгоритм заливки с затравкой (настоящий)
function seedFill(startX, startY, fillColor) {
	// Получаем данные изображения БЕЗ очистки холста
	const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const pixels = imageData.data;

	// Переводим fillColor (hex) в RGB
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
	if (isSimilarColor(targetR, targetG, targetB, fillR, fillG, fillB)) {
		return; // Область уже закрашена тем же цветом
	}

	// Получаем цвет границы
	const [borderR, borderG, borderB] = [0, 0, 255]; // Синий цвет границы

	// Стек для алгоритма
	const stack = [[startX, startY]];

	// Добавляем функцию проверки цвета пикселя
	const isTargetColor = (x, y) => {
		const i = (y * canvas.width + x) * 4;
		return isSimilarColor(
			pixels[i], pixels[i + 1], pixels[i + 2],
			targetR, targetG, targetB
		);
	};

	// Проверяем, не является ли пиксель границей
	const isBorderColor = (x, y) => {
		const i = (y * canvas.width + x) * 4;
		return isSimilarColor(
			pixels[i], pixels[i + 1], pixels[i + 2],
			borderR, borderG, borderB
		);
	};

	// Закрашиваем пиксель
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
	drawFigure();
}

// Алгоритм построчного сканирования
function scanlineFill(fillColor) {
	// Создаем временный холст для отрисовки только новой заливки
	const tempCanvas = document.createElement('canvas');
	tempCanvas.width = canvas.width;
	tempCanvas.height = canvas.height;
	const tempCtx = tempCanvas.getContext('2d');

	// Рисуем контур на временном холсте
	tempCtx.beginPath();
	tempCtx.strokeStyle = CONFIG.colors.border;
	tempCtx.lineWidth = 2;
	tempCtx.moveTo(...points[0]);
	for (let i = 1; i < points.length; i++) {
		tempCtx.lineTo(...points[i]);
	}
	tempCtx.stroke();

	// Определяем границы фигуры
	const minX = Math.min(...points.map(p => p[0])) - 1;
	const maxX = Math.max(...points.map(p => p[0])) + 1;
	const minY = Math.min(...points.map(p => p[1])) - 1;
	const maxY = Math.max(...points.map(p => p[1])) + 1;

	// Получаем данные изображения временного холста
	const tempImageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
	const tempPixels = tempImageData.data;

	// Проверяем, является ли пиксель границей
	const isBorderPixel = (x, y) => {
		const idx = (y * canvas.width + x) * 4;
		return tempPixels[idx + 2] > 200; // Синий компонент (для синей границы)
	};

	// Проходим по всей области фигуры
	tempCtx.fillStyle = fillColor;

	for (let y = minY; y <= maxY; y++) {
		const intersections = [];

		// Находим пересечения со всеми отрезками
		for (let i = 0; i < points.length - 1; i++) {
			const [x1, y1] = points[i];
			const [x2, y2] = points[i + 1];

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

	// Переводим fillColor (hex) в RGB
	const hexToRgb = (hex) => {
		const r = parseInt(hex.slice(1, 3), 16);
		const g = parseInt(hex.slice(3, 5), 16);
		const b = parseInt(hex.slice(5, 7), 16);
		return [r, g, b];
	};

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
	drawFigure();
}

// Обработчики событий
document.getElementById('fillColor').addEventListener('input', (e) => {
	currentFillColor = e.target.value;
});

document.getElementById('seedFill').addEventListener('click', () => {
	isDrawingMode = true;
	canvas.style.cursor = 'crosshair';
	// alert('Кликните внутри фигуры для заливки');
});

canvas.addEventListener('click', (e) => {
	if (!isDrawingMode) return;

	const rect = canvas.getBoundingClientRect();
	const x = Math.floor(e.clientX - rect.left);
	const y = Math.floor(e.clientY - rect.top);

	seedFill(x, y, currentFillColor);
	isDrawingMode = false;
	canvas.style.cursor = 'default';
});

document.getElementById('scanlineFill').addEventListener('click', () => {
	scanlineFill(currentFillColor);
});

document.getElementById('reset').addEventListener('click', () => {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	drawFigure();
});

// Инициализация
drawFigure(); 