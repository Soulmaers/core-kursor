


function addInternalLink(pdfDoc, page, rect, targetPageIndex) {
    const { PDFName, PDFArray } = require('pdf-lib');

    const targetPage = pdfDoc.getPage(targetPageIndex);
    const dest = pdfDoc.context.obj([targetPage.ref, PDFName.of('Fit')]);

    const action = pdfDoc.context.obj({
        S: PDFName.of('GoTo'),
        D: dest,
    });

    const annot = pdfDoc.context.obj({
        Type: PDFName.of('Annot'),
        Subtype: PDFName.of('Link'),
        Rect: rect,          // [x1, y1, x2, y2] — координаты PDF (ноль внизу слева)
        Border: [0, 0, 0],   // без рамки
        A: action,           // действие
    });

    const annotRef = pdfDoc.context.register(annot);

    // ВЗЯТЬ ИЛИ СОЗДАТЬ массив аннотаций страницы
    let annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
    if (!annots) {
        annots = pdfDoc.context.obj([]);
        page.node.set(PDFName.of('Annots'), annots);
    }
    annots.push(annotRef);
}

function addTocLinks(pdfDoc, pageNumber, data, typeTitleReports) {
    const tocPageIndex = 1; // 0 — титул, 1 — страница оглавления/навигации
    const tocPage = pdfDoc.getPage(tocPageIndex);
    const { width, height } = tocPage.getSize();

    // === ГЕОМЕТРИЯ ПРАВОЙ КОЛОНКИ С НОМЕРАМИ ===
    // Эти X должны совпадать с позицией правой колонки в твоём HTML.
    const rightColX1 = width - 500; // левая граница клика
    const rightColX2 = width - 28; // правая граница клика

    // === ВЕРСТОЧНЫЕ КОНСТАНТЫ (синхронизируй с CSS .title_type/.next и т.п.) ===
    const statTopY = height - 80; // где стоит строка "Статистика"
    const statLineH = 20;           // высота строки с номером "Статистика"
    const gapAfterStatBlock = 8;           // отступ после строки "Статистика" перед заголовком "Компонентный"

    const compTitleTopY = statTopY - statLineH - gapAfterStatBlock; // где рисуется заголовок "Компонентный"
    const compTitleH = 24;           // высота строки заголовка "Компонентный"
    const compItemTopGap = 6;            // отступ от заголовка "Компонентный" до первой строки списка
    const compItemLineH = 23;           // line-height строки компонента
    const gapAfterCompBlock = 1;           // отступ после списка компонент перед заголовком "Графический"

    // Заголовок "Графический" начинается после заголовка "Компонентный" + его элементов + gapAfterCompBlock:
    // точное значение посчитаем после того, как узнаем число компонент.

    // Собираем элементы оглавления В ТОЧНО ТОМ ЖЕ порядке, как в HTML:
    const compItems = []; // массив {title, page}
    const graphItems = []; // массив {title, page}

    // 1) Статистика
    const statPage = pageNumber['Статистика'];

    // 2) Компонентные
    for (const key of Object.keys(data[0][1])) {
        const filtered = trueAttributes(data[0][1][key]);
        if (!filtered?.length || key === 'Техническое обслуживание') continue;
        const section = typeTitleReports[1] + key; // "Компонентный" + key
        compItems.push({ title: section, page: pageNumber[section] });
    }

    // 3) Графические
    for (const key of Object.keys(data[0][2])) {
        const filtered = trueAttributes(data[0][2][key]);
        if (!filtered?.length) continue;
        const section = typeTitleReports[2] + key; // "Графический" + key
        graphItems.push({ title: section, page: pageNumber[section] });
    }

    // ——— КЛИК ПО "Статистика"
    if (statPage) {
        const rect = [rightColX1, statTopY - statLineH + 4, rightColX2, statTopY + 2];
        addInternalLink(pdfDoc, tocPage, rect, statPage - 1);
    }

    // ——— КЛИКИ ПО БЛОКУ "Компонентный"
    // стартовая Y координата первой строки списка компонент:
    let compCursorY = compTitleTopY - compTitleH - compItemTopGap;
    compItems.forEach((item, i) => {
        if (!item.page) return;
        const yTop = compCursorY - i * compItemLineH;
        const rect = [rightColX1, yTop - compItemLineH + 4, rightColX2, yTop + 2];
        addInternalLink(pdfDoc, tocPage, rect, item.page - 1);
    });

    // ——— КЛИКИ ПО БЛОКУ "Графический"
    // заголовок "Графический" стоит после списка компонент:
    const graphTitleTopY = compCursorY - compItems.length * compItemLineH - gapAfterCompBlock;
    const graphTitleH = 24; // высота строки заголовка "Графический"
    const graphItemTopGap = 1;  // отступ от заголовка до первой строки списка
    const graphItemLineH = 21; // высота строки графика

    let graphCursorY = graphTitleTopY - graphTitleH - graphItemTopGap;
    graphItems.forEach((item, i) => {
        if (!item.page) return;
        const yTop = graphCursorY - i * graphItemLineH;
        const rect = [rightColX1, yTop - graphItemLineH + 4, rightColX2, yTop + 2];
        addInternalLink(pdfDoc, tocPage, rect, item.page - 1);
    });
}

function trueAttributes(obj) {
    const res = obj.filter(e => e.checked === true).map(it => it)
    return res
}


async function addPageNumbers(pdfDoc) {
    // Получаем общее количество страниц
    const totalPages = pdfDoc.getPageCount();

    // Проходим по всем страницам
    for (let i = 0; i < totalPages; i++) {
        if (i === 0) continue
        const page = pdfDoc.getPage(i);
        const pageNumber = i + 1; // Нумерация начинается с 1

        // Получаем размеры страницы
        const { width, height } = page.getSize();

        // Добавляем номер страницы в правый нижний угол
        page.drawText(pageNumber.toString(), {
            x: width - 30, // Отступ от правого края
            y: 10,         // Отступ от нижнего края
            size: 15,
            // color: colors.black,
            align: 'right'
        });
    }
}

module.exports = { addPageNumbers, addTocLinks, trueAttributes }