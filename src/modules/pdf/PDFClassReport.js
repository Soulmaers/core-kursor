
const fs = require('fs')
const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');
const path = require('path'); // Подключаем модуль path
const { renderChartsLegend } = require('./renderChartsLegend')
const { createRowComponentTitle, createHeaderLowPages, createHeaderLowGroupAndObjectPages, pageStart, pageStatic, pageNavi, pageComponents } = require('./generationHTML')
const { addPageNumbers, addTocLinks, trueAttributes } = require('./servisNumberNavgationPages')
const { chartRegistry, renderDefault } = require('./chartRegistrary');

class PDFClassReports {
    constructor(nameObjects, nameReports, data, filePath) {
        this.imagePath = path.join(__dirname, './assets/logo_kursor.png'); // Создаем абсолютный путь к файлу
        this.imagePathLogoMini = path.join(__dirname, './assets/logo_mini.png');
        this.data = data
        this.filePath = filePath
        this.nameReports = nameReports
        this.nameObjects = nameObjects
        this.pdfDocuments = [];
        this.typeTitleReports = ['Статистика', 'Компонентный', 'Графический']
        this.count = 0
        this.title = ['Начальное местоположение', 'Местоположение', 'Конечное местоположение']
        this.pageNumberMap = {};
        this.styles = fs.readFileSync(path.join(__dirname, './report.css'), 'utf-8');
        this.image = `data:image/png;base64,${fs.readFileSync(this.imagePath, 'base64')}`;
        this.imageLogoMini = `data:image/png;base64,${fs.readFileSync(this.imagePathLogoMini, 'base64')}`;
    }



    sorting() {
        const getKey = x => String(x?.[0]?.['Статистика']?.[1]?.result ?? '');

        this.data.sort((a, b) => {
            const A = getKey(a);
            const B = getKey(b);
            if (A < B) return -1;
            if (A > B) return 1;
            return 0;
        });
    }
    async init() {
        this.sorting()
        this.pdfDoc = await PDFDocument.create();
        await this.buildHTML();   // он сам внутри поднимет браузер один раз
        addTocLinks(this.pdfDoc, this.pageNumberMap, this.data, this.typeTitleReports);             // ← добавили кликабельные переходы внутри PDF
        await addPageNumbers(this.pdfDoc);
        await this.savePDF();
        return this.filePath;
    }



    createPageStatistika() {
        return this.data.map((obj) => {

            const statBlock = obj[0]['Статистика'] || [];
            const group_name = obj[0]['Статистика'][0]?.result ?? '';
            const object_name = obj[0]['Статистика'][1]?.result ?? '';

            const header = createHeaderLowPages('СТАТИСТИКА', this.imageLogoMini);
            const low_header = createHeaderLowGroupAndObjectPages(group_name, object_name);

            const rows = statBlock.map(e => `
      <tr>
        <td class="left_stat">${e.name}</td>
        <td class="right_stat">${e.result ?? 'Н/Д'} ${e.local ?? ''}</td>
      </tr>
    `).join('');

            return pageStatic(this.styles, header, low_header, rows);
        });
    }


    createPageStart() {
        const startTime = this.data[0][0]['Статистика'][2].result.slice(0, 8)
        const endTime = this.data[0][0]['Статистика'][3].result.slice(0, 8)
        //   const titleGroup = [this.data[0][0]['Статистика'][0].result]
        const titleGroups = [...new Set(this.data.map(e => e?.[0]?.['Статистика']?.[0]?.result).filter(Boolean))];
        return pageStart(this.styles, this.image, this.nameReports, startTime, endTime, titleGroups, this.nameObjects)
    }

    createNavigationPages(sectionStartIndexes) {
        const titleTypeReports = this.typeTitleReports.map((e, index) => {
            if (index === 0) {
                return `
            <div class="title_type first">
                <div class="title_name">${e}</div>
                <div class="dashes"></div>
                <div class="title_number">${sectionStartIndexes[e] || '?'}</div>
            </div>
            `;
            } else {
                const componentsBlock = Object.keys(this.data[0][index])
                    .map(key => {
                        const rawList = this.data[0][index][key];
                        const filtered = trueAttributes(rawList); // отфильтровали только checked
                        if (!filtered || filtered.length === 0) return ''; // если ничего — пропускаем
                        return createRowComponentTitle(key, e, sectionStartIndexes)
                    })
                    .join('');
                return `<div class="next"><div class="title_name">${e}</div>${componentsBlock}</div> `;
            }
        }).join('');

        const header = createHeaderLowPages('ОГЛАВЛЕНИЕ', this.imageLogoMini)
        return pageNavi(this.styles, header, titleTypeReports)
    }



    createComponent(objData, data, key) {
        const componentBorder = ['Поездки', 'Простои на холостом ходу', 'Стоянки', 'Остановки', 'Учёт топлива'].includes(key);

        const titleObject = objData[0]['Статистика'][1]?.result ?? '';
        const titleGroup = objData[0]['Статистика'][0]?.result ?? '';

        const landscape = !(key === 'Стоянки' || key === 'Остановки');
        const width = landscape ? '100%' : '50%';

        const header = createHeaderLowPages(key.toUpperCase(), this.imageLogoMini);
        const low_header = createHeaderLowGroupAndObjectPages(titleGroup, titleObject);

        const titleComponent = (data || []).map(elem => `<th class="colums">${elem.name}</th>`).join('');

        if (!data?.length || !data[0]?.result) {
            return pageComponents(this.styles, header, low_header, titleComponent, landscape, width);
        }

        const tableBody = data[0].result.map((_row, rowIdx) => {
            const cells = data.map(col => {
                const classleft = this.title.includes(col.name) ? 'left_stat' : '';
                const isLastRow = rowIdx === data[0].result.length - 1;
                const cellClass = isLastRow && componentBorder ? 'last-row-cell' : '';
                return `<td class="${classleft} ${cellClass}">${col.result[rowIdx] ?? '-'}</td>`;
            }).join('');
            return `<tr>${cells}</tr>`;
        }).join('');

        return pageComponents(this.styles, header, low_header, titleComponent, landscape, width, tableBody);
    }

    // простой лимитер параллелизма (без доп. библиотек)
    pLimit(concurrency) {
        const queue = [];
        let activeCount = 0;
        const next = () => {
            activeCount--;
            if (queue.length > 0) {
                const fn = queue.shift();
                fn();
            }
        };
        return (fn) =>
            new Promise((resolve, reject) => {
                const run = () => {
                    activeCount++;
                    fn().then(
                        (val) => { resolve(val); next(); },
                        (err) => { reject(err); next(); }
                    );
                };
                if (activeCount < concurrency) run();
                else queue.push(run);
            });
    }

    // единый helper: HTML → PDF Buffer
    async renderHtmlToPdf(page, html, opts = {}) {
        await page.setContent(html, { waitUntil: 'load' }); // если есть внешние ресурсы — 'networkidle0'
        await page.emulateMediaType('screen');
        return page.pdf({
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: true,
            landscape: !!opts.landscape,
            margin: { top: '0mm', bottom: '5mm', left: '5mm', right: '5mm' },
            displayHeaderFooter: false,
            headerTemplate: '<span></span>',
            footerTemplate: '<span></span>',
        });
    }

    async buildHTML() {
        // 0) собрать задачи
        const pagesToRender = [];

        const statPages = this.createPageStatistika();
        statPages.forEach((html, idx) => {
            pagesToRender.push({
                html,
                landscape: false,
                sectionTitle: 'Статистика'

            });
        });

        // собираем все ключи компонент по всем объектам
        const allCompKeys = Array.from(new Set(
            this.data.flatMap(objData => Object.keys(objData?.[1] || {}))
        )).filter(k => k !== 'Техническое обслуживание');

        // для каждого ключа — пройти все объекты и добавить страницу
        for (const key of allCompKeys) {
            for (const objData of this.data) {
                const rawCols = objData?.[1]?.[key];
                let cols = rawCols ? trueAttributes(rawCols) : [];
                if (!cols?.length) continue;

                // твоя логика «Пробеги»: отрезать последний столбец
                if (key === 'Пробеги' && cols.length) cols = cols.slice(0, -1);

                const page = this.createComponent(objData, cols, key);
                pagesToRender.push({
                    ...page,
                    // Внимание: один и тот же sectionTitle для всех объектов одного компонента —
                    // это ок, если в оглавлении нужно к первому листу компонента.
                    sectionTitle: this.typeTitleReports[1] + key, // "Компонентный" + key
                });
            }
        }
        const allGraphKeys = Array.from(new Set(
            this.data.flatMap(objData => Object.keys(objData?.[2] || {}))
        ));

        for (const key of allGraphKeys) {
            for (const objData of this.data) {
                const raw = objData?.[2]?.[key];
                const series = raw ? trueAttributes(raw) : [];
                if (!series?.length) continue;

                const pagesOrOne = await this.createChart(objData, series, key);

                if (Array.isArray(pagesOrOne)) {
                    pagesOrOne.forEach(p =>
                        pagesToRender.push({
                            ...p,
                            sectionTitle: this.typeTitleReports[2] + key, // "Графический" + key
                        })
                    );
                } else {
                    pagesToRender.push({
                        ...pagesOrOne,
                        sectionTitle: this.typeTitleReports[2] + key,
                    });
                }
            }
        }

        // 1) один браузер на всё
        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
        const limit = this.pLimit(8); // параллелизм: подбери под сервер

        // 2) рендерим секции параллельно (с лимитом)
        const rendered = await Promise.all(
            pagesToRender.map(({ html, landscape = false, sectionTitle }) =>
                limit(async () => {
                    const page = await browser.newPage();
                    try {
                        const pdfBuffer = await this.renderHtmlToPdf(page, html, { landscape });
                        return { sectionTitle, pdfBuffer };
                    } finally {
                        await page.close();
                    }
                })
            )
        );

        // 3) посчитаем количества страниц в каждой секции
        const pageCounts = await Promise.all(
            rendered.map(async ({ pdfBuffer }) => {
                const tmpDoc = await PDFDocument.load(pdfBuffer);
                return tmpDoc.getPageCount();
            })
        );

        const TOC_PAGES = 2;
        const sectionStartIndexes = {};
        {
            let acc = TOC_PAGES; // после двух страниц TOC
            for (let i = 0; i < rendered.length; i++) {
                const { sectionTitle } = rendered[i];

                // если это ПЕРВОЕ появление этого sectionTitle — фиксируем старт
                if (!(sectionTitle in sectionStartIndexes)) {
                    sectionStartIndexes[sectionTitle] = acc + 1; // человекочитаемая нумерация
                }

                // сдвигаем счётчик на реальное число страниц текущего блока
                acc += pageCounts[i];
            }
        }
        // 5) отрисуем 2 страницы оглавления (TOC + навигация), зная sectionStartIndexes
        const tocHtml = this.createPageStart(sectionStartIndexes);
        const tocNaviHtml = this.createNavigationPages(sectionStartIndexes);

        const tocBuf = await (async () => {
            const p = await browser.newPage();
            try { return await this.renderHtmlToPdf(p, tocHtml); }
            finally { await p.close(); }
        })();

        const naviBuf = await (async () => {
            const p = await browser.newPage();
            try { return await this.renderHtmlToPdf(p, tocNaviHtml); }
            finally { await p.close(); }
        })();

        // 6) браузер больше не нужен
        await browser.close();

        // 7) собрать итоговый PDF: сначала 2 страницы TOC, потом все секции
        const tocDoc = await PDFDocument.load(tocBuf);
        const naviDoc = await PDFDocument.load(naviBuf);

        const copiedToc = await this.pdfDoc.copyPages(tocDoc, tocDoc.getPageIndices());
        this.pdfDoc.addPage(copiedToc[0]);

        const copiedNavi = await this.pdfDoc.copyPages(naviDoc, naviDoc.getPageIndices());
        this.pdfDoc.addPage(copiedNavi[0]);

        for (const { sectionTitle, pdfBuffer } of rendered) {
            const doc = await PDFDocument.load(pdfBuffer);
            const copied = await this.pdfDoc.copyPages(doc, doc.getPageIndices());
            copied.forEach((p) => this.pdfDoc.addPage(p));
        }

        // 8) заполним карту "секция → страница"
        this.pageNumberMap = sectionStartIndexes;
    }

    async savePDF() {
        const pdfBytes = await this.pdfDoc.save();
        fs.writeFileSync(this.filePath, pdfBytes);
    }

    async createChart(objData, data, key) {
        const titleObject = objData[0]['Статистика'][1]?.result ?? '';
        const titleGroup = objData[0]['Статистика'][0]?.result ?? '';

        const header = createHeaderLowPages(key.toUpperCase(), this.imageLogoMini);
        const low_header = createHeaderLowGroupAndObjectPages(titleGroup, titleObject);

        const typeTitle = this.typeTitleReports[2]; // "Графический"
        const renderer = chartRegistry.get(key) || renderDefault;

        if (!data?.length || !data[0]?.result) {
            // пустой блок — отрисуем только каркас
            return pageComponents(this.styles, header, low_header, [], true, '100%');
        }

        // большинство рендереров возвращают массив страниц (или одну) — сохраняем совместимость
        return renderer({ key, data, styles: this.styles, typeTitle, header, low_header });
    }



    // Внутрь класса PDFClassReports

    _isMulti() {
        return this.data && Array.isArray(this.data.object);
    }

    // возвращает массив объектов в едином формате:
    // { objectName, groupName, data } — data та же форма что и при одиночном отчёте
    _getObjectsList() {
        if (!this._isMulti()) {
            const groupName = this.data[0]['Статистика'][0].result;
            const objectName = this.data[0]['Статистика'][1].result;
            return [{ objectName, groupName, data: this.data }];
        }
        return this.data.object.map(o => ({
            objectName: o.objectName,
            groupName: o.groupName,
            data: o.data, // ожидается тот же формат [Статистика, Компонентный, Графический]
        }));
    }


}




module.exports = PDFClassReports



