from flask import Flask, render_template, request, jsonify
import json
import numpy as np
import logging

# Настройка логирования
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Используем ту же фигуру из задания "Аффинные преобразования"
ORIGINAL_SHAPE = [
    (350, 200), # верхняя середина
    (250, 150), # левая верхняя точка
    (300, 250), # нижняя левая точка
    (350, 220), # нижняя середина
    (400, 250), # правая нижняя точка
    (450, 150) # правая вернхяя точка
]

@app.route('/')
def index():
    # При первой загрузке отдадим оригинал
    return render_template('index.html', shape=ORIGINAL_SHAPE)

# Функция для проверки, находится ли точка внутри многоугольника
def is_point_in_polygon(x, y, polygon):
    inside = False
    for i in range(len(polygon)):
        j = (i - 1) % len(polygon)
        if (((polygon[i][1] > y) != (polygon[j][1] > y)) and
            (x < (polygon[j][0] - polygon[i][0]) * (y - polygon[i][1]) / (polygon[j][1] - polygon[i][1]) + polygon[i][0])):
            inside = not inside
    return inside

# Алгоритм заливки с затравкой
def flood_fill(image, x, y, fill_color, boundary_color, width, height):
    """Рекурсивный алгоритм заливки с затравкой"""
    # Реализуем через стек чтобы избежать переполнения стека
    stack = [(x, y)]
    visited = set()
    
    while stack:
        cx, cy = stack.pop()
        
        # Проверяем границы
        if cx < 0 or cx >= width or cy < 0 or cy >= height:
            continue
            
        # Проверяем, посещали ли мы этот пиксель
        if (cx, cy) in visited:
            continue
            
        # Проверяем цвет текущего пикселя
        current_color = image[cy][cx]
        
        # Если пиксель уже закрашен нужным цветом или это граница
        if current_color == fill_color or current_color == boundary_color:
            continue
            
        # Закрашиваем пиксель
        image[cy][cx] = fill_color
        visited.add((cx, cy))
        
        # Добавляем соседние пиксели
        stack.append((cx + 1, cy))
        stack.append((cx - 1, cy))
        stack.append((cx, cy + 1))
        stack.append((cx, cy - 1))
    
    return image

# Алгоритм построчного сканирования
def scanline_fill(image, polygon, fill_color, boundary_color, width, height):
    """Алгоритм построчного сканирования для заливки многоугольника"""
    # Находим границы полигона
    min_y = min(point[1] for point in polygon)
    max_y = max(point[1] for point in polygon)
    
    # Проходим по каждой строке внутри границ полигона
    for y in range(int(min_y), int(max_y) + 1):
        # Находим пересечения
        intersections = []
        
        for i in range(len(polygon)):
            j = (i + 1) % len(polygon)  # Используем следующую точку, а не предыдущую
            
            y1 = polygon[i][1]
            y2 = polygon[j][1]
            
            # Проверяем, пересекает ли строка ребро
            if (y1 <= y < y2) or (y2 <= y < y1):
                x1 = polygon[i][0]
                x2 = polygon[j][0]
                
                # Вычисляем x-координату пересечения
                if y1 != y2:
                    x = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
                    intersections.append(int(x))
        
        # Сортируем пересечения
        intersections.sort()
        
        # Заполняем пиксели между парами пересечений
        for i in range(0, len(intersections), 2):
            if i + 1 < len(intersections):
                start_x = max(0, intersections[i])
                end_x = min(width - 1, intersections[i + 1])
                
                for x in range(start_x, end_x + 1):
                    image[y][x] = fill_color
    
    # Отмечаем контур
    for i in range(len(polygon)):
        j = (i + 1) % len(polygon)
        x1, y1 = int(polygon[i][0]), int(polygon[i][1])
        x2, y2 = int(polygon[j][0]), int(polygon[j][1])
        
        # Используем алгоритм Брезенхэма для рисования линии контура
        draw_line(image, x1, y1, x2, y2, boundary_color, width, height)
    
    return image

# Функция для рисования линии по алгоритму Брезенхэма
def draw_line(image, x1, y1, x2, y2, color, width, height):
    """Рисует линию с использованием алгоритма Брезенхэма"""
    dx = abs(x2 - x1)
    dy = abs(y2 - y1)
    sx = 1 if x1 < x2 else -1
    sy = 1 if y1 < y2 else -1
    err = dx - dy
    
    while True:
        if 0 <= x1 < width and 0 <= y1 < height:
            image[y1][x1] = color
        
        if x1 == x2 and y1 == y2:
            break
            
        e2 = 2 * err
        if e2 > -dy:
            err -= dy
            x1 += sx
        if e2 < dx:
            err += dx
            y1 += sy

@app.route('/api/fill', methods=['POST'])
def api_fill():
    """Unified API endpoint for both filling algorithms"""
    try:
        data = request.json
        logger.debug(f"Получен запрос: {data}")
        
        shape = data.get('shape', ORIGINAL_SHAPE)
        fill_color = data.get('fill_color', '#ff8c42')
        boundary_color = data.get('boundary_color', '#3a86ff')
        algorithm = data.get('algorithm', 'flood_fill')
        
        # Создаем изображение
        width, height = 600, 400
        
        # Инициализируем пустое изображение (0 = не закрашено)
        image = np.zeros((height, width), dtype=int)
        
        # Преобразуем HEX цвета в индексы для изображения
        fill_color_index = 1    # Индекс для цвета заливки
        boundary_color_index = 2  # Индекс для цвета границы
        
        # Рисуем контур
        for i in range(len(shape)):
            j = (i + 1) % len(shape)
            x1, y1 = int(shape[i][0]), int(shape[i][1])
            x2, y2 = int(shape[j][0]), int(shape[j][1])
            
            # Рисуем линию контура
            draw_line(image, x1, y1, x2, y2, boundary_color_index, width, height)
        
        # Применяем выбранный алгоритм заливки
        if algorithm == 'flood_fill':
            # Получаем точку затравки
            seed_point = data.get('seed_point', None)
            if seed_point:
                seed_x, seed_y = int(seed_point['x']), int(seed_point['y'])
                logger.debug(f"Точка затравки: ({seed_x}, {seed_y})")
                
                if 0 <= seed_x < width and 0 <= seed_y < height:
                    image = flood_fill(image, seed_x, seed_y, fill_color_index, boundary_color_index, width, height)
                else:
                    logger.warning(f"Точка затравки вне границ изображения: ({seed_x}, {seed_y})")
            else:
                logger.warning("Отсутствует точка затравки в запросе")
                
        elif algorithm == 'scanline':
            image = scanline_fill(image, shape, fill_color_index, boundary_color_index, width, height)
        
        # Создаем цветовую карту для возврата на клиент
        color_map = {
            "0": "transparent",
            "1": fill_color,
            "2": boundary_color
        }
        
        # Формируем результат
        result = {
            'image': image.tolist(),
            'color_map': color_map,
            'width': width,
            'height': height
        }
        
        logger.debug(f"Отправлен ответ с размером {width}x{height}")
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"Ошибка при обработке запроса: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True) 