console.log("Sequencer Backend Running");
figma.showUI(__html__, { width: 1000, height: 800 });

// Хелпер для получения цвета фона фрейма
function getBackgroundColor(node) {
  if (node.fills && node.fills.length > 0) {
    for (const fill of node.fills) {
      if (fill.visible && fill.type === 'SOLID') {
        const { r, g, b } = fill.color;
        const o = fill.opacity !== undefined ? fill.opacity : 1;
        return `rgba(${Math.round(r*255)}, ${Math.round(g*255)}, ${Math.round(b*255)}, ${o})`;
      }
    }
  }
  return 'rgba(255,255,255,1)';
}

// Основная функция сканирования макета
async function processFrames() {
  const selection = figma.currentPage.selection.filter(n => n.type === "FRAME");
  
  if (selection.length === 0) {
    figma.ui.postMessage({ type: "selection-data", valid: false });
    return;
  }

  // Сортировка фреймов по имени (1, 2, 3...)
  selection.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

  const framesData = [];
  
  for (const frame of selection) {
    const layers = [];
    const children = frame.children;

    // Загружаем сохраненные настройки анимации, если есть
    const savedDataString = frame.getPluginData('sequencer-data');
    let savedSettings = null;
    if (savedDataString) {
      try { savedSettings = JSON.parse(savedDataString); } catch (e) {}
    }

    for (const node of children) {
      if (node.visible) {
        try {
          const previewBytes = await node.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: 1 } });
          const exportSetting = node.exportSettings[0];
          const exportFormat = exportSetting ? exportSetting.format : 'PNG';

          layers.push({
            id: node.id, 
            name: node.name, 
            x: node.x, 
            y: node.y, 
            width: node.width, 
            height: node.height, 
            previewBytes: previewBytes,
            exportFormat: exportFormat
          });
        } catch(e) {
            console.error(`Error processing layer ${node.name}:`, e);
        }
      }
    }

    framesData.push({
      id: frame.id, 
      name: frame.name, 
      width: frame.width, 
      height: frame.height,
      bgColor: getBackgroundColor(frame), 
      layers: layers, 
      savedSettings: savedSettings
    });
  }

  figma.ui.postMessage({ type: "selection-data", valid: true, frames: framesData });
}

figma.on("selectionchange", processFrames);
setTimeout(processFrames, 100);

figma.ui.onmessage = async (msg) => {
  if (msg.type === "save-settings") {
    const frame = await figma.getNodeByIdAsync(msg.frameId);
    if (frame) {
        frame.setPluginData('sequencer-data', JSON.stringify(msg.settings));
    }
  }
  else if (msg.type === "load-library") {
    const lib = await figma.clientStorage.getAsync('custom-css-library');
    figma.ui.postMessage({ type: "library-loaded", library: lib || [] });
  }
  else if (msg.type === "save-library") {
    await figma.clientStorage.setAsync('custom-css-library', msg.library);
  }
  else if (msg.type === "export-request") {
    const allAssets = {};
    const exportScale = msg.exportScale || 2; 

    try {
      for (const frame of msg.frames) {
        for (const layer of frame.layers) {
           const node = await figma.getNodeByIdAsync(layer.id);
           if (node) {
             let exportOptions = { 
               format: "PNG", 
               constraint: { type: "SCALE", value: exportScale } 
             };
             let mimeType = "image/png";
             let ext = "png";

             // Проверяем настройки экспорта слоя в Figma
             if (node.exportSettings && node.exportSettings.length > 0) {
                 // Берем первую настройку
                 const setting = node.exportSettings[0];
                 if (setting.format === "SVG") {
                     exportOptions = { format: "SVG" };
                     mimeType = "image/svg+xml";
                     ext = "svg";
                 } else if (setting.format === "JPG") {
                     exportOptions = { 
                         format: "JPG", 
                         constraint: { type: "SCALE", value: exportScale } 
                     };
                     mimeType = "image/jpeg";
                     ext = "jpg";
                 }
                 // Если PNG, оставляем настройки по умолчанию (с нашим масштабом)
             }

             const bytes = await node.exportAsync(exportOptions);
             
             allAssets[layer.id] = {
                 data: bytes,
                 mime: mimeType,
                 ext: ext
             };
           }
        }
      }
      figma.ui.postMessage({ type: "export-done", assets: allAssets });
    } catch (e) {
      figma.ui.postMessage({ type: "error", message: e.message });
    }
  }
};

