import os
from PIL import Image

def get_bands(values, threshold=10):
    # Находит непрерывные отрезки (полосы), где количество пикселей больше порога
    bands = []
    in_band = False
    start = 0
    for i, v in enumerate(values):
        if v >= threshold and not in_band:
            in_band = True
            start = i
        elif v < threshold and in_band:
            in_band = False
            if i - start > 30: # Игнорируем совсем мелкий мусор
                bands.append((start, i))
    
    if in_band and len(values) - start > 30:
        bands.append((start, len(values)))
        
    return bands

def main():
    img_path = r"c:\Users\balac\Desktop\GAMEALLREADY\jused\data\Images\Ivons.png"
    if not os.path.exists(img_path):
        print("Файл Ivons.png не найден!")
        return
        
    img = Image.open(img_path).convert("RGB")
    w, h = img.size
    
    # Считаем количество НЕ-БЕЛЫХ пикселей в каждой строке и столбце
    col_counts = [0] * w
    row_counts = [0] * h
    
    pixels = img.load()
    for y in range(h):
        for x in range(w):
            r, g, b = pixels[x, y]
            # Если хотя бы один канал темнее 245, считаем пиксель частью иконки
            if r < 245 or g < 245 or b < 245:
                col_counts[x] += 1
                row_counts[y] += 1
                
    # Получаем границы каждой колонки и каждого ряда (там, где есть картинка)
    # Порог 5 пикселей - чтобы случайно не зацепить 1 пиксель пыли
    x_bands = get_bands(col_counts, threshold=5)
    y_bands = get_bands(row_counts, threshold=5)
    
    print(f"Найдено колонок иконок: {len(x_bands)}")
    print(f"Найдено рядов иконок: {len(y_bands)}")
    
    if len(x_bands) != 5 or len(y_bands) != 2:
        print("ВНИМАНИЕ: Скрипт ожидал ровно 5 колонок и 2 ряда. Если их больше/меньше, значит на фоне есть пятна или рамка сливается. Продолжаю как есть...")

    out_dir = r"c:\Users\balac\Desktop\GAMEALLREADY\jused\data\Images\tabs"
    os.makedirs(out_dir, exist_ok=True)
    
    names = [
        "materialy", "obvinenie", "zaschita", "svideteli", "uliki",
        "expertiza", "suspect", "victim", "medexpert", "cabinet"
    ]
    
    img_rgba = img.convert("RGBA")
    idx = 0
    
    # Нарезаем строго по найденным заполненным границам
    for r_idx, (y0, y1) in enumerate(y_bands[:2]):
        for c_idx, (x0, x1) in enumerate(x_bands[:5]):
            if idx >= len(names):
                break
                
            cell = img_rgba.crop((x0, y0, x1, y1))
            
            # Делаем белые углы снаружи рамочек прозрачными
            d = cell.getdata()
            nd = []
            for item in d:
                if item[0]>245 and item[1]>245 and item[2]>245:
                    nd.append((255,255,255,0))
                else:
                    nd.append(item)
            cell.putdata(nd)
            
            out_path = os.path.join(out_dir, f"{names[idx]}.png")
            cell.save(out_path)
            print(f"[{idx+1}/10] Сохранено: {names[idx]}.png (Размер: {cell.width}x{cell.height})")
            idx += 1
            
    print("Успех! Теперь каждая иконка вырезана ИДЕАЛЬНО ровно по своим краям.")

if __name__ == "__main__":
    main()
