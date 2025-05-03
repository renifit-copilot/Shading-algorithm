from flask import Flask, render_template, request, jsonify
import json

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

@app.route('/api/seed_fill', methods=['POST'])
def api_seed_fill():
    """API для алгоритма заливки с затравкой"""
    data = request.json
    shape = data.get('shape', ORIGINAL_SHAPE)
    seed_point = data['seedPoint']
    fill_color = data['fillColor']
    
    # На сервере нам не нужно реализовывать алгоритм заливки
    # Это будет делаться на клиенте через canvas
    # Просто возвращаем необходимые данные
    return jsonify(shape=shape, seedPoint=seed_point, fillColor=fill_color)

@app.route('/api/scan_line', methods=['POST'])
def api_scan_line():
    """API для алгоритма построчного сканирования"""
    data = request.json
    shape = data.get('shape', ORIGINAL_SHAPE)
    fill_color = data['fillColor']
    
    # Алгоритм будет реализован на клиенте
    return jsonify(shape=shape, fillColor=fill_color)

if __name__ == '__main__':
    app.run(debug=True) 