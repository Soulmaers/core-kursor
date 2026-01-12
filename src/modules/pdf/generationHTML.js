

function createRowComponentTitle(key, e, pageNumberMaps) {
    return `
                    <div class="title_type title_component_sub">
                        <div class="component_title">${key}</div>
                              <div class="dashes"></div>
                <div class="title_number">${pageNumberMaps[e + key] || '?'}</div>
                                          </div>
                `;
}

function createHeaderLowPages(title_name, imageLogoMini) {
    return `<div class="header_logo_oglavlenie">
            <div class="ogl">${title_name}</div>
            <img class="img_logo_mini" src="${imageLogoMini}" /></div>`
}

function createHeaderLowGroupAndObjectPages(group_name, object_name) {
    return `<div class="wrapper_low_title">
            <div class="name_object_and_group">ОБЪЕКТ: <span class="obj">${object_name}<span></div>
            <div class="name_object_and_group">ГРУППА: <span class="obj">${group_name}<span></div></div>`
}

function pageStart(styles, image, nameReports, startTime, endTime, titleGroup, nameObjects) {
    return `
        <html>
           ${getStyles(styles)}
            <body class="body_pdf">
            <div class="one_container">
                             <div class="header_logo"><img class="img_logo" src="${image}" /></div>
                             <div class="title_info">СИСТЕМА МОНИТОРИНГА ТРАНСПОРТА</div>
                                   <div class="title_info">ИНФОРМАЦИОННЫЙ ОТЧЕТ</div> 
                                   </div>   
                                   <div class="two_container">
                                   <div class="title_spans">НАЗВАНИЕ: ${nameReports}</div>
                                    <div class="title_spans">ОТЧЕТНЫЙ ПЕРИОД:  ${startTime} / ${endTime}</div>
                                    <div class="title_spans">ГРУППА: ${titleGroup.join(', ')}</div>
                                    <div class="title_spans clamp">ОБЪЕКТЫ: ${nameObjects.join(', ')}</div>
                                   </div>  
                                     <div class="footer_title_page">
                                     <span class="podpis">г. Санкт-Петербург</span>
                                      <span class="podpis">www.cursor-gps.ru</span>
                                     </div>                 
                          </body>
        </html>
        `;
}


function pageStatic(styles, header, low_header, rows) {
    return `
          <html>
           ${getStyles(styles)}
            <body class="body_pdf oglav">${header} ${low_header}
            <div class="statistika_page">
           <table class="statistika_table">
                           <tbody>
                ${rows}
              </tbody>
            </table>
      </div>
               </body>
        </html>`

}


function pageNavi(styles, header, titleTypeReports) {
    return `<html>
          ${getStyles(styles)}
            <body class="body_pdf oglav">
               ${header}
                <div class="contant_title">${titleTypeReports}</div>
            </body>
        </html>`

}

function pageComponents(styles, header, low_header, titleComponent, landscape, width, tableBody) {
    const tableBodyHTML = tableBody ? `<tbody>${tableBody}</tbody>` : ''
    return {
        html: `<html>
           ${getStyles(styles)}
            <body class="body_pdf oglav">
            ${header}${low_header}
                       <div class="page_component" style=width:${width} >
                               <table class="components_table">
                    <thead><tr>${titleComponent}</tr></thead>
                    ${tableBodyHTML}
                                  </table>
                        </div>   
                                                       
                          </body>
                         
        </html>`, landscape: landscape
    }
}




function getStyles(styles) {
    return `<head>
        <style>${styles}</style>
    </head>`
}
module.exports = {
    createRowComponentTitle,
    createHeaderLowPages,
    createHeaderLowGroupAndObjectPages,
    pageStart,
    getStyles,
    pageStatic,
    pageNavi,
    pageComponents
}