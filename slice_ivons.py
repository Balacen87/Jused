import os
from PIL import Image, ImageChops

def trim(im):
    # Обрезаем все белые поля вокруг всей сетки
    bg = Image.new(im.mode, im.size, (255, 255, 255))
    diff = ImageChops.difference(im, bg)
    diff = ImageChops.add(diff, diff, 2.0, -100)
    bbox = diff.getbbox()
    if bbox:
        return im.crop(bbox)
    return im

def main():
    img_path = r"c:\Users\balac\Desktop\GAMEALLREADY\jused\data\Images\Ivons.png"
    if not os.path.exists(img_path):
        print("Файл Ivons.png не найден.")
        return

    img = Image.open(img_path).convert("RGB")
    
    # 1. Сначала отрезаем огромные белые поля по краям картинки
    trimmed = trim(img)
    
    # 2. Теперь картинка идеально прилегает к краям ячеек
    w, h = trimmed.size
    cols, rows = 5, 2
    cw = w // cols
    ch = h // rows

    names = [
        "materialy", "obvinenie", "zaschita", "svideteli", "uliki",
        "expertiza", "suspect", "victim", "medexpert", "cabinet"
    ]

    out_dir = r"c:\Users\balac\Desktop\GAMEALLREADY\jused\data\Images\tabs"
    os.makedirs(out_dir, exist_ok=True)

    img_rgba = trimmed.convert("RGBA")
    
    idx = 0
    for row in range(rows):
        for col in range(cols):
            left = col * cw
            upper = row * ch
            right = left + cw
            lower = upper + ch
            
            # Вырезаем одну ячейку-кнопку
            cell = img_rgba.crop((left, upper, right, lower))
            
            # Делаем белый фон вокруг нарисованной рамки прозрачным
            datas = cell.getdata()
            new_data = []
            for item in datas:
                if item[0] > 240 and item[1] > 240 and item[2] > 240:
                    new_data.append((255, 255, 255, 0))
                else:
                    new_data.append(item)
            cell.putdata(new_data)
            
            out_path = os.path.join(out_dir, f"{names[idx]}.png")
            cell.save(out_path)
            print(f"[{idx+1}/10] Сохранено: {out_path} (Размер: {cell.width}x{cell.height})")
            idx += 1
            
    print("Нарезка завершена успешно!")

if __name__ == '__main__':
    main()
