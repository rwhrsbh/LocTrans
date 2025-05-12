// File handling utilities

function estimateWordCount(file) {
    const reader = new FileReader();
    
    reader.onload = function(event) {
        const content = event.target.result;
        const wordCount = countWords(content);
        document.getElementById('word-limit-counter').textContent = wordCount.toLocaleString();
        
        // Visual indication if word limit is exceeded
        const wordLimitElement = document.querySelector('.word-limit-info');
        if (wordCount > 1000000) {
            wordLimitElement.style.color = 'var(--error-color)';
        } else {
            wordLimitElement.style.color = '#777';
        }
    };
    
    reader.readAsText(file);
}

function estimateWordCountForMultipleFiles(files) {
    let totalWordCount = 0;
    let filesProcessed = 0;
    
    for (let i = 0; i < files.length; i++) {
        const reader = new FileReader();
        
        reader.onload = function(event) {
            const content = event.target.result;
            const wordCount = countWords(content);
            totalWordCount += wordCount;
            filesProcessed++;
            
            // Update counter when all files are processed
            if (filesProcessed === files.length) {
                document.getElementById('word-limit-counter').textContent = totalWordCount.toLocaleString();
                
                // Visual indication if word limit is exceeded
                const wordLimitElement = document.querySelector('.word-limit-info');
                if (totalWordCount > 1000000) {
                    wordLimitElement.style.color = 'var(--error-color)';
                } else {
                    wordLimitElement.style.color = '#777';
                }
            }
        };
        
        reader.readAsText(files[i]);
    }
}

function countWords(text) {
    // Basic word counting - may need refinement based on specific file formats
    // This is simplified and may over-count when dealing with markup files
    
    // Remove XML/HTML tags
    const noTags = text.replace(/<[^>]*>/g, ' ');
    
    // Remove special characters and extra spaces
    const cleaned = noTags.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Count words
    return cleaned ? cleaned.split(' ').length : 0;
}

function getFileType(file) {
    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith('.json')) return 'json';
    if (fileName.endsWith('.xml')) return 'xml';
    if (fileName.endsWith('.csv')) return 'csv';
    if (fileName.endsWith('.md')) return 'md';
    return 'txt'; // Default
}

function parseFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        const fileType = getFileType(file);
        
        reader.onload = function(event) {
            const content = event.target.result;
            let parsedData;
            
            try {
                switch (fileType) {
                    case 'json':
                        parsedData = JSON.parse(content);
                        break;
                    case 'xml':
                        // Using DOMParser for XML
                        const parser = new DOMParser();
                        parsedData = parser.parseFromString(content, 'text/xml');
                        break;
                    case 'csv':
                        // Simple CSV parsing (comma-separated)
                        parsedData = parseCSV(content);
                        break;
                    default:
                        // For text files, split by lines
                        parsedData = content.split('\n');
                }
                resolve({ data: parsedData, type: fileType, raw: content });
            } catch (error) {
                reject(`Ошибка при чтении файла: ${error.message}`);
            }
        };
        
        reader.onerror = () => reject('Ошибка при чтении файла');
        reader.readAsText(file);
    });
}

function parseCSV(content) {
    const lines = content.split('\n');
    return lines.map(line => line.split(','));
}

function createDownloadLink(translatedContents, fileNames, fileTypes) {
    // Очищаем предыдущие данные, если они существуют
    if (window.downloadData && window.downloadData.url) {
        URL.revokeObjectURL(window.downloadData.url);
    }
    
    // Если передан только один файл, преобразуем в массивы
    if (!Array.isArray(translatedContents)) {
        translatedContents = [translatedContents];
        fileNames = [fileNames];
        fileTypes = [fileTypes];
    }
    
    // Проверяем количество файлов
    if (translatedContents.length === 1) {
        // Для одного файла - создаем прямую ссылку без архива
        const content = translatedContents[0];
        const fileName = fileNames[0]; // Сохраняем оригинальное имя файла с расширением
        
        // Создаем Blob из содержимого
        const blob = new Blob([content], { type: getContentType(fileTypes[0]) });
        const url = URL.createObjectURL(blob);
        
        // Сохраняем данные для скачивания
        window.downloadData = {
            url: url,
            fileName: fileName
        };
        
        // Показываем кнопку скачивания
        document.getElementById('download-container').classList.remove('hidden');
    } else {
        // Для нескольких файлов - создаем ZIP-архив
        // Загружаем JSZip библиотеку динамически, если она еще не загружена
        if (typeof JSZip === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = function() {
                createZipArchive(translatedContents, fileNames);
            };
            document.head.appendChild(script);
        } else {
            createZipArchive(translatedContents, fileNames);
        }
    }
}

// Вспомогательная функция для определения MIME-типа содержимого
function getContentType(fileType) {
    switch (fileType) {
        case 'json': return 'application/json';
        case 'xml': return 'application/xml';
        case 'csv': return 'text/csv';
        default: return 'text/plain';
    }
}

function createZipArchive(translatedContents, fileNames) {
    const zip = new JSZip();
    
    // Добавляем каждый переведенный файл в архив с оригинальным именем
    for (let i = 0; i < translatedContents.length; i++) {
        // Сохраняем оригинальное имя файла без изменений
        const fileName = fileNames[i];
        
        zip.file(fileName, translatedContents[i]);
    }
    
    // Генерируем ZIP-архив
    zip.generateAsync({ type: 'blob' })
        .then(function(content) {
            const url = URL.createObjectURL(content);
            
            // Создаем имя для архива с датой
            const date = new Date();
            const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
            const zipFileName = `translated_files_${dateStr}.zip`;
            
            // Store download data
            window.downloadData = {
                url: url,
                fileName: zipFileName
            };
            
            // Показываем кнопку скачивания
            document.getElementById('download-container').classList.remove('hidden');
        });
}

function downloadTranslatedFile() {
    if (!window.downloadData) return;
    
    const a = document.createElement('a');
    a.href = window.downloadData.url;
    a.download = window.downloadData.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}