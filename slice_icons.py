import os
from PIL import Image

def main():
    img_path = r"c:\Users\balac\Desktop\GAMEALLREADY\jused\data\Images\Icons.png"
    if not os.path.exists(img_path):
        print("Image not found: Icons.png")
        return

    # Открываем изображение и конвертируем в RGBA
    img = Image.open(img_path).convert("RGBA")
    
    # Делаем белый и близкий к белому фон прозрачным
    datas = img.getdata()
    newData = []
    # Чуть более строгий порог, чтобы не задеть белые элементы в иконках
    for item in datas:
        if item[0] > 245 and item[1] > 245 and item[2] > 245:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)
    img.putdata(newData)

    width, height = img.size
    cols = 4
    rows = 3
    
    # Точные размеры одной ячейки в сетке 4x3
    col_w = width // cols
    row_h = height // rows

    names = [
        "delo", "obvinenie", "zaschita", "svideteli",
        "uliki", "expertiza", "suspect", "victim",
        "medexpert", "cabinet"
    ]

    out_dir = r"c:\Users\balac\Desktop\GAMEALLREADY\jused\data\Images\tabs"
    os.makedirs(out_dir, exist_ok=True)

    idx = 0
    for row in range(rows):
        for col in range(cols):
            # В третьем ряду иконки расположены во 2-й и 3-й колонках (индексы 1 и 2)
            if row == 2 and col == 0: continue
            if row == 2 and col == 3: continue

            if idx >= len(names): break

            left = col * col_w
            upper = row * row_h
            right = left + col_w
            lower = upper + row_h
            
            # Вырезаем ячейку из сетки
            cell = img.crop((left, upper, right, lower))
            
            # Отрезаем нижние ~20% ячейки, где находится русский текст (чтобы осталась только картинка)
            # Оставляем остальные границы неизменными, чтобы центрирование иконок совпадало
            cell_no_text = cell.crop((0, 0, col_w, int(row_h * 0.82)))
            
            out_path = os.path.join(out_dir, f"{names[idx]}.png")
            cell_no_text.save(out_path)
            print(f"[{idx+1}/10] Сохранено: {out_path} (Размер: {cell_no_text.width}x{cell_no_text.height})")
            idx += 1

    print("Все иконки успешно нарезаны в одинаковом размере!")

if __name__ == '__main__':
    main()

