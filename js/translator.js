// Standard translation handling

async function handleStandardTranslation() {
    const files = document.getElementById('standard-file').files;
    if (files.length === 0) return;
    
    const sourceLang = document.getElementById('source-lang').value;
    const targetLang = document.getElementById('target-lang').value;
    
    // Отримуємо вибраний API перекладу та ключ
    const translationApi = document.getElementById('translation-api').value;
    const apiKey = document.getElementById('api-key-standard').value.trim();
    
    // Валідація API ключа
    const validationResult = validateApiKey(translationApi, apiKey);
    if (!validationResult.valid) {
        alert(`Неверный формат API ключа для ${getApiName(translationApi)}\n\n${validationResult.message}`);
        return;
    }
    
    showResultContainer();
    
    // Перевіряємо наявність елемента для сообщений о лимите
    let limitMessageElement = document.getElementById('api-limit-message-standard');
    if (!limitMessageElement) {
        // Создаем элемент, если его нет
        limitMessageElement = document.createElement('p');
        limitMessageElement.id = 'api-limit-message-standard';
        limitMessageElement.className = 'api-limit-message';
        limitMessageElement.style.color = 'var(--warning-color)';
        limitMessageElement.style.fontWeight = 'bold';
        limitMessageElement.style.marginTop = '10px';
        // Добавляем элемент после status-message
        const statusElement = document.getElementById('status-message');
        statusElement.parentNode.insertBefore(limitMessageElement, statusElement.nextSibling);
        // Изначально скрываем
        limitMessageElement.style.display = 'none';
    }
    
    try {
        // Массивы для хранения результатов
        const translatedContents = [];
        const fileNames = [];
        const fileTypes = [];
        
        // Обновляем статус с общим количеством файлов
        document.getElementById('status-message').textContent = `Обработка файлов (0/${files.length})...`;
        
        // Обрабатываем каждый файл
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Обновляем прогресс по общему количеству файлов
            const fileProgressPercent = (i / files.length) * 100;
            document.getElementById('progress-bar').style.width = `${fileProgressPercent}%`;
            document.getElementById('status-message').textContent = `Обработка файлов (${i+1}/${files.length})...`;
            
            try {
                // Parse the file
                const parsedFile = await parseFile(file);
                
                // Extract texts for translation while preserving keys and tags
                const { textsToTranslate, structure } = extractTranslatableTexts(parsedFile);
                
                // Translate the texts using selected API
                document.getElementById('status-message').textContent = 
                    `Файл ${i+1}/${files.length}: Перевод текста...`;
                const translatedTexts = await translateTexts(
                    textsToTranslate, 
                    sourceLang, 
                    targetLang, 
                    i+1, 
                    files.length, 
                    translationApi, 
                    apiKey
                );
                
                // Reconstruct the file with translated texts
                const translatedContent = reconstructFile(translatedTexts, structure, parsedFile);
                
                // Сохраняем результаты
                translatedContents.push(translatedContent);
                fileNames.push(file.name);
                fileTypes.push(parsedFile.type);
            } catch (error) {
                // Проверяем, связана ли ошибка с недействительным API ключом
                if (error.message && (
                    error.message.includes('API key not valid') || 
                    error.message.includes('invalid auth') ||
                    error.message.includes('authorization failed') ||
                    error.message.includes('authentication failed') ||
                    error.message.includes('401'))) {
                    
                    document.getElementById('status-message').textContent = `Ошибка: Недействительный API ключ для ${getApiName(translationApi)}`;
                    document.getElementById('progress-bar').style.width = '100%';
                    document.getElementById('progress-bar').style.backgroundColor = 'var(--error-color)';
                    return;
                }
                
                // Проверяем, связана ли ошибка с лимитом API
                if (error.message && (
                    error.message.includes('Превышен лимит запросов API') || 
                    error.message.includes('Rate limit exceeded') ||
                    error.message.includes('quota exceeded'))) {
                    
                    // Показываем сообщение о временном превышении лимита в отдельном параграфе
                    document.getElementById('api-limit-message-standard').textContent = 
                        `Превышен лимит API. Ожидаем 1 минуту перед продолжением...`;
                    document.getElementById('api-limit-message-standard').style.display = 'block';
                    
                    // Ждем 1 минуту
                    await new Promise(resolve => setTimeout(resolve, 60000));
                    
                    // Скрываем сообщение о лимите
                    document.getElementById('api-limit-message-standard').style.display = 'none';
                    
                    // Уменьшаем индекс, чтобы повторить этот файл
                    i--;
                    continue;
                }
                
                console.error(`Ошибка при обработке файла ${file.name}:`, error);
                document.getElementById('status-message').textContent = 
                    `Предупреждение: Не удалось обработать файл ${file.name}: ${error.message || error}`;
                
                // Небольшая пауза, чтобы пользователь мог прочитать сообщение об ошибке
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
        
        // Если нет обработанных файлов, выбрасываем ошибку
        if (translatedContents.length === 0) {
            throw new Error('Не удалось обработать ни один файл.');
        }
        
        // Prepare download
        createDownloadLink(translatedContents, fileNames, fileTypes);
        
        // Show download button
        document.getElementById('progress-bar').style.width = '100%';
        document.getElementById('progress-bar').style.backgroundColor = 'var(--success-color)';
        
        // Показываем сообщение в зависимости от количества файлов
        if (translatedContents.length === 1) {
            document.getElementById('status-message').textContent = `Перевод завершен! Файл готов к скачиванию.`;
        } else {
            document.getElementById('status-message').textContent = `Перевод завершен! Обработано файлов: ${translatedContents.length} из ${files.length}`;
        }
        
        document.getElementById('download-container').classList.remove('hidden');
        
        // Скрываем сообщение о лимите, если оно отображалось
        document.getElementById('api-limit-message-standard').style.display = 'none';
        
    } catch (error) {
        document.getElementById('status-message').textContent = `Ошибка: ${error.message || error}`;
        document.getElementById('progress-bar').style.width = '100%';
        document.getElementById('progress-bar').style.backgroundColor = 'var(--error-color)';
        
        // Скрываем сообщение о лимите
        document.getElementById('api-limit-message-standard').style.display = 'none';
    }
}

function showResultContainer() {
    const resultContainer = document.getElementById('result-container');
    resultContainer.classList.remove('hidden');
    document.getElementById('download-container').classList.add('hidden');
    document.getElementById('progress-bar').style.width = '0%';
    document.getElementById('progress-bar').style.backgroundColor = 'var(--secondary-color)';
    document.getElementById('status-message').textContent = 'Обработка файлов...';
}

function extractTranslatableTexts(parsedFile) {
    let textsToTranslate = [];
    let structure = [];
    
    switch (parsedFile.type) {
        case 'json':
            ({ textsToTranslate, structure } = extractFromJSON(parsedFile.data));
            break;
        case 'xml':
            ({ textsToTranslate, structure } = extractFromXML(parsedFile.data));
            break;
        case 'csv':
            ({ textsToTranslate, structure } = extractFromCSV(parsedFile.data));
            break;
        default:
            ({ textsToTranslate, structure } = extractFromText(parsedFile.data));
    }
    
    return { textsToTranslate, structure };
}

function extractFromJSON(data, parentKey = '') {
    let textsToTranslate = [];
    let structure = [];
    
    if (typeof data === 'object' && data !== null) {
        Object.keys(data).forEach(key => {
            const currentKey = parentKey ? `${parentKey}.${key}` : key;
            
            if (typeof data[key] === 'string') {
                // Extract any tags/variables from the string
                const { text, tags } = extractTags(data[key]);
                textsToTranslate.push(text);
                structure.push({ key: currentKey, type: 'string', tags });
            } else if (Array.isArray(data[key])) {
                data[key].forEach((item, index) => {
                    if (typeof item === 'string') {
                        const { text, tags } = extractTags(item);
                        textsToTranslate.push(text);
                        structure.push({ key: `${currentKey}[${index}]`, type: 'string', tags });
                    } else {
                        const { textsToTranslate: nestedTexts, structure: nestedStructure } = 
                            extractFromJSON(item, `${currentKey}[${index}]`);
                        textsToTranslate = [...textsToTranslate, ...nestedTexts];
                        structure = [...structure, ...nestedStructure];
                    }
                });
            } else if (typeof data[key] === 'object' && data[key] !== null) {
                const { textsToTranslate: nestedTexts, structure: nestedStructure } = 
                    extractFromJSON(data[key], currentKey);
                textsToTranslate = [...textsToTranslate, ...nestedTexts];
                structure = [...structure, ...nestedStructure];
            }
        });
    }
    
    return { textsToTranslate, structure };
}

function extractFromXML(xmlDoc) {
    let textsToTranslate = [];
    let structure = [];
    const textNodes = [];
    
    function traverseNode(node, path = '') {
        if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim()) {
            textNodes.push({ node, path });
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const currentPath = path ? `${path}/${node.nodeName}` : node.nodeName;
            for (let i = 0; i < node.childNodes.length; i++) {
                traverseNode(node.childNodes[i], currentPath);
            }
        }
    }
    
    traverseNode(xmlDoc.documentElement);
    
    textNodes.forEach(({ node, path }, index) => {
        const { text, tags } = extractTags(node.nodeValue);
        textsToTranslate.push(text);
        structure.push({ 
            key: `${path}#${index}`, 
            type: 'xml-text', 
            tags,
            originalNode: node
        });
    });
    
    return { textsToTranslate, structure };
}

function extractFromCSV(data) {
    let textsToTranslate = [];
    let structure = [];
    
    data.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            if (cell && cell.trim()) {
                const { text, tags } = extractTags(cell);
                textsToTranslate.push(text);
                structure.push({ 
                    key: `${rowIndex},${colIndex}`, 
                    type: 'csv-cell', 
                    tags 
                });
            }
        });
    });
    
    return { textsToTranslate, structure };
}

function extractFromText(lines) {
    let textsToTranslate = [];
    let structure = [];
    
    // Додаємо дебаг інформацію
    console.log("Розпочинаємо обробку тексту, рядків:", lines.length);
    
    lines.forEach((line, index) => {
        console.log(`Обробка рядка ${index}:`, line);
        
        if (line && line.trim()) {
            // Перевіряємо, чи рядок містить лише [заголовок], який не потрібно перекладати
            if (/^\[\w+\]$/.test(line.trim())) {
                console.log(`Рядок ${index} є заголовком секції, пропускаємо`);
                textsToTranslate.push('');
                structure.push({ 
                    key: `${index}`, 
                    type: 'section-header', 
                    originalLine: line
                });
                return;
            }
            
            // Спеціальний патерн для локалізаційних файлів: КЛЮЧ="Текст для перекладу"
            const locPattern = /^([A-Z0-9_]+)=(".*")$/;
            const locMatch = line.match(locPattern);
            
            if (locMatch) {
                const locKey = locMatch[1];      // наприклад CIN_Intro_01
                const quotedText = locMatch[2];  // "текст у лапках"
                
                console.log(`Знайдено локалізаційний ключ: ${locKey}, значення: ${quotedText}`);
                
                // Видаляємо зовнішні лапки для обробки
                const textWithoutQuotes = quotedText.substring(1, quotedText.length - 1);
                
                // Зберігаємо оригінальний ключ і обробляємо текст
                const { text, tags } = extractTags(textWithoutQuotes);
                
                textsToTranslate.push(text);
                structure.push({
                    key: `${index}`,
                    type: 'localization-key',
                    locKey: locKey,            // Зберігаємо оригінальний ключ локалізації
                    originalText: textWithoutQuotes,
                    tags: tags
                });
                return;
            }
            
            // Стандартна обробка для інших форматів ключ=значення
            const keyMatch = line.match(/^([^=:]+)[=:](.*)/);
            if (keyMatch) {
                const key = keyMatch[1].trim();
                let value = keyMatch[2].trim();
                
                console.log(`Знайдено звичайний ключ: ${key}, значення: ${value}`);
                
                // Перевіряємо, чи значення починається та закінчується лапками
                const hasQuotes = value.startsWith('"') && value.endsWith('"');
                
                // Якщо є лапки, видаляємо їх для перекладу, але зберігаємо цю інформацію
                if (hasQuotes) {
                    value = value.substring(1, value.length - 1);
                }
                
                // Якщо значення порожнє або містить лише спеціальні символи/числа, не перекладаємо
                if (!value.trim() || /^[0-9\s\-\+\*\/\.\,\;\:\?\!\@\#\$\%\^\&\(\)\[\]\{\}\<\>\=\_\|]*$/.test(value)) {
                    console.log(`Значення не містить тексту для перекладу, пропускаємо`);
                    textsToTranslate.push('');
                    structure.push({ 
                        key: `${index}`, 
                        type: 'key-value-no-translate',
                        originalKey: key,
                        originalValue: value,
                        separator: line.includes('=') ? '=' : ':',
                        hasQuotes: hasQuotes
                    });
                    return;
                }
                
                const { text, tags } = extractTags(value);
                textsToTranslate.push(text);
                structure.push({ 
                    key: `${index}`, 
                    type: 'key-value',
                    originalKey: key,
                    separator: line.includes('=') ? '=' : ':',
                    hasQuotes: hasQuotes,
                    isLocalizationKey: /^[A-Z0-9_]+$/.test(key),
                    tags
                });
            } else {
                // Звичайний текстовий рядок без ключа
                console.log(`Звичайний текстовий рядок`);
                const { text, tags } = extractTags(line);
                textsToTranslate.push(text);
                structure.push({ 
                    key: `${index}`, 
                    type: 'line', 
                    tags 
                });
            }
        } else {
            // Empty line
            console.log(`Порожній рядок`);
            textsToTranslate.push('');
            structure.push({ key: `${index}`, type: 'empty' });
        }
    });
    
    console.log("Структура тексту після обробки:", structure);
    console.log("Тексти для перекладу:", textsToTranslate);
    
    return { textsToTranslate, structure };
}

function extractTags(text) {
    // Функція виділяє теги та змінні з тексту для збереження їх під час перекладу
    console.log("Початок обробки тегів тексту:", text);
    
    // Масив для зберігання виділених тегів
    const tags = [];
    
    // Копія тексту для обробки
    let processedText = text;
    
    // 1. Заміняємо спеціальні випадки екранованих лапок \"
    processedText = processedText.replace(/\\"/g, (match, offset) => {
        const tagId = tags.length;
        tags.push({ type: 'escaped-quote', value: match, originalPosition: offset });
        const placeholder = `__LOCTAG_${tagId}__`;
        console.log(`Знайдено екрановані лапки на позиції ${offset}: ${match} → ${placeholder}`);
        return placeholder;
    });
    
    // 2. HTML/XML теги (наприклад <b>текст</b>)
    processedText = processedText.replace(/<[^>]+>/g, (match, offset) => {
        const tagId = tags.length;
        tags.push({ type: 'html', value: match, originalPosition: offset });
        const placeholder = `__LOCTAG_${tagId}__`;
        console.log(`Знайдено HTML тег на позиції ${offset}: ${match} → ${placeholder}`);
        return placeholder;
    });
    
    // 3. Форматні специфікатори (%s, %d тощо)
    processedText = processedText.replace(/%[sdifoxXeEgGaAcCpn]/g, (match, offset) => {
        const tagId = tags.length;
        tags.push({ type: 'format', value: match, originalPosition: offset });
        const placeholder = `__LOCTAG_${tagId}__`;
        console.log(`Знайдено форматний специфікатор на позиції ${offset}: ${match} → ${placeholder}`);
        return placeholder;
    });
    
    // 4. Плейсхолдери типу {0}, {name} тощо
    processedText = processedText.replace(/\{[^}]+\}/g, (match, offset) => {
        const tagId = tags.length;
        tags.push({ type: 'placeholder', value: match, originalPosition: offset });
        const placeholder = `__LOCTAG_${tagId}__`;
        console.log(`Знайдено плейсхолдер на позиції ${offset}: ${match} → ${placeholder}`);
        return placeholder;
    });
    
    // 5. Змінні локалізації у форматі $var$ та інші
    processedText = processedText.replace(/\$[a-zA-Z0-9_]+\$/g, (match, offset) => {
        const tagId = tags.length;
        tags.push({ type: 'variable', value: match, originalPosition: offset });
        const placeholder = `__LOCTAG_${tagId}__`;
        console.log(`Знайдено змінну локалізації на позиції ${offset}: ${match} → ${placeholder}`);
        return placeholder;
    });
    
    // Додаємо пробіли між тегами, щоб уникнути їх злиття при перекладі
    processedText = processedText.replace(/__LOCTAG_(\d+)____LOCTAG_/g, '__LOCTAG_$1__ __LOCTAG_');
    
    console.log("Текст після обробки всіх тегів:", processedText);
    console.log("Всього виділено тегів:", tags.length);
    
    return { text: processedText, tags };
}

async function translateTexts(texts, sourceLang, targetLang, currentFileNum, totalFiles, translationApi, apiKey) {
    // Простий прогрес
    const statusElement = document.getElementById('status-message');
    const progressBar = document.getElementById('progress-bar');
    const limitMessage = document.getElementById('api-limit-message-standard');
    
    // Очищаємо повідомлення про ліміти
    limitMessage.style.display = 'none';
    
    // Масив для зберігання перекладених текстів
    const translatedTexts = [];
    
    // Створюємо масив індексів не порожніх текстів
    const nonEmptyIndices = [];
    for (let i = 0; i < texts.length; i++) {
        if (texts[i].trim()) {
            nonEmptyIndices.push(i);
        }
    }
    
    // Готуємо порожній масив результатів такого ж розміру як і оригінальний
    for (let i = 0; i < texts.length; i++) {
        translatedTexts[i] = texts[i]; // За замовчуванням залишаємо оригінал
    }
    
    // Якщо немає текстів для перекладу, просто повертаємо оригінал
    if (nonEmptyIndices.length === 0) {
        return translatedTexts;
    }
    
    // Інформація про прогрес
    const totalTexts = nonEmptyIndices.length;
    let translatedCount = 0;
    
    try {
        // Перекладаємо кожен непорожній текст окремо
        for (const index of nonEmptyIndices) {
            const textToTranslate = texts[index];
            
            // Оновлюємо статус
            statusElement.textContent = `Переклад тексту (${translatedCount+1}/${totalTexts})...`;
            
            // Поновлюємо прогрес бар
            const percent = ((translatedCount / totalTexts) * 100);
            progressBar.style.width = `${percent}%`;
            
            try {
                // Перекладаємо текст через відповідний API
                const translatedText = await translateSingleText(
                    textToTranslate,
                    sourceLang,
                    targetLang,
                    translationApi,
                    apiKey
                );
                
                // Зберігаємо переклад
                translatedTexts[index] = translatedText;
                
            } catch (error) {
                console.error(`Помилка перекладу для тексту №${index}:`, error);
                
                // Якщо помилка пов'язана з лімітами API
                if (error.message && (
                    error.message.includes('Rate limit') || 
                    error.message.includes('Quota') || 
                    error.message.includes('Too many request') ||
                    error.message.includes('429')
                )) {
                    // Показуємо повідомлення про ліміт
                    limitMessage.textContent = 'Перевищено ліміт API. Очікуємо 1 хвилину...';
                    limitMessage.style.display = 'block';
                    
                    // Чекаємо хвилину
                    await new Promise(resolve => setTimeout(resolve, 60000));
                    
                    // Ховаємо повідомлення
                    limitMessage.style.display = 'none';
                    
                    // Повторюємо цей текст
                    translatedCount--;
                } else if (error.message && (
                    error.message.includes('API key') ||
                    error.message.includes('auth') ||
                    error.message.includes('401')
                )) {
                    // Критична помилка з ключем API
                    throw new Error(`Невірний API ключ для ${getApiName(translationApi)}: ${error.message}`);
                } else {
                    // Інші помилки - використовуємо оригінальний текст
                    console.warn(`Використовуємо оригінальний текст через помилку: ${error.message}`);
                }
            }
            
            // Збільшуємо лічильник перекладених текстів
            translatedCount++;
        }
        
        // Успішний переклад всіх текстів
        return translatedTexts;
        
    } catch (error) {
        // Прокидаємо помилку вище
        throw error;
    }
}

// Функція для перекладу одного тексту через вибраний API
async function translateSingleText(text, sourceLang, targetLang, translationApi, apiKey) {
    console.log(`Перевод текста (${translationApi}): "${text.substr(0, 50)}${text.length > 50 ? '...' : ''}"`);
    
    if (!text.trim()) {
        return text; // Повертаємо порожній текст без перекладу
    }
    
    try {
        let translatedText;
        
        switch (translationApi) {
            case 'google':
                translatedText = await translateWithGoogleSimple(text, sourceLang, targetLang, apiKey);
                break;
            case 'deepl':
                translatedText = await translateWithDeepLSimple(text, sourceLang, targetLang, apiKey);
                break;
            case 'microsoft':
                translatedText = await translateWithMicrosoftSimple(text, sourceLang, targetLang, apiKey);
                break;
            default:
                throw new Error(`Невідомий API перекладу: ${translationApi}`);
        }
        
        console.log(`Переведено (${translationApi}): "${translatedText.substr(0, 50)}${translatedText.length > 50 ? '...' : ''}"`);
        return translatedText;
        
    } catch (error) {
        console.error('Помилка перекладу:', error);
        throw error;
    }
}

// Спрощена функція для Google Translate API (один текст)
async function translateWithGoogleSimple(text, sourceLang, targetLang, apiKey) {
    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
    
    // Налаштовуємо коди мов
    const googleSourceLang = adjustGoogleLanguageCode(sourceLang);
    const googleTargetLang = adjustGoogleLanguageCode(targetLang);
    
    // Підготовка запиту
    const requestData = {
        q: text,
        source: googleSourceLang,
        target: googleTargetLang,
        format: 'text'
    };
    
    try {
        // Виконуємо запит до API
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        // Отримуємо відповідь як текст для аналізу помилок
        const responseText = await response.text();
        let responseData;
        
        try {
            responseData = JSON.parse(responseText);
        } catch (e) {
            throw new Error(`Неочікуваний формат відповіді: ${responseText}`);
        }
        
        // Перевіряємо статус відповіді
        if (!response.ok) {
            let errorMessage = `Google Translate API: помилка ${response.status}`;
            
            if (responseData && responseData.error) {
                errorMessage = `Google API: ${responseData.error.message || responseData.error.code}`;
                
                if (responseData.error.message.includes('API key not valid')) {
                    errorMessage = 'Невірний ключ Google API. Перевірте його та спробуйте знову.';
                }
            }
            
            throw new Error(errorMessage);
        }
        
        // Перевіряємо формат даних
        if (!responseData || !responseData.data || !responseData.data.translations || !responseData.data.translations[0]) {
            throw new Error('Неочікуваний формат відповіді від Google Translate API');
        }
        
        // Повертаємо перекладений текст
        return responseData.data.translations[0].translatedText;
        
    } catch (error) {
        console.error('Помилка Google Translate API:', error);
        throw error;
    }
}

// Спрощена функція для DeepL API (один текст)
async function translateWithDeepLSimple(text, sourceLang, targetLang, apiKey) {
    // Визначаємо тип API (безкоштовний чи Pro) по ключу
    const isProKey = !apiKey.endsWith(':fx');
    const baseUrl = isProKey ? 
        'https://api.deepl.com/v2/translate' : 
        'https://api-free.deepl.com/v2/translate';
    
    // Налаштовуємо коди мов
    const deeplSourceLang = adjustDeepLLanguageCode(sourceLang);
    const deeplTargetLang = adjustDeepLLanguageCode(targetLang);
    
    try {
        // Готуємо дані запиту
        const formData = new FormData();
        formData.append('text', text);
        formData.append('source_lang', deeplSourceLang);
        formData.append('target_lang', deeplTargetLang);
        
        // Виконуємо запит до API
        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Authorization': `DeepL-Auth-Key ${apiKey}`
            },
            body: formData
        });
        
        // Отримуємо відповідь як текст для аналізу помилок
        const responseText = await response.text();
        let responseData;
        
        try {
            responseData = JSON.parse(responseText);
        } catch (e) {
            throw new Error(`Неочікуваний формат відповіді: ${responseText}`);
        }
        
        // Перевіряємо статус відповіді
        if (!response.ok) {
            let errorMessage = `DeepL API: помилка ${response.status}`;
            
            if (responseData && responseData.message) {
                errorMessage = `DeepL API: ${responseData.message}`;
            }
            
            // Спеціальні коди помилок
            if (response.status === 403) {
                errorMessage = 'Помилка авторизації DeepL API. Перевірте ваш ключ.';
            } else if (response.status === 401) {
                errorMessage = 'Невірний ключ DeepL API. Перевірте його та спробуйте знову.';
            } else if (response.status === 429) {
                errorMessage = 'Перевищено ліміт запитів до DeepL API.';
            }
            
            throw new Error(errorMessage);
        }
        
        // Перевіряємо формат даних
        if (!responseData || !responseData.translations || !responseData.translations[0]) {
            throw new Error('Неочікуваний формат відповіді від DeepL API');
        }
        
        // Повертаємо перекладений текст
        return responseData.translations[0].text;
        
    } catch (error) {
        console.error('Помилка DeepL API:', error);
        throw error;
    }
}

// Спрощена функція для Microsoft Translator API (один текст)
async function translateWithMicrosoftSimple(text, sourceLang, targetLang, apiKey) {
    const endpoint = 'https://api.cognitive.microsofttranslator.com';
    const url = `${endpoint}/translate?api-version=3.0&from=${sourceLang}&to=${targetLang}`;
    
    // Підготовка даних запиту
    const requestData = [{ text }];
    
    try {
        // Виконуємо запит до API
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Ocp-Apim-Subscription-Key': apiKey,
                'Ocp-Apim-Subscription-Region': 'global' // Змініть на ваш регіон, якщо потрібно
            },
            body: JSON.stringify(requestData)
        });
        
        // Отримуємо відповідь як текст для аналізу помилок
        const responseText = await response.text();
        let responseData;
        
        try {
            responseData = JSON.parse(responseText);
        } catch (e) {
            throw new Error(`Неочікуваний формат відповіді: ${responseText}`);
        }
        
        // Перевіряємо статус відповіді
        if (!response.ok) {
            let errorMessage = `Microsoft Translator API: помилка ${response.status}`;
            
            if (responseData && responseData.error) {
                errorMessage = `Microsoft API: ${responseData.error.message || responseData.error.code}`;
            }
            
            // Спеціальні коди помилок
            if (response.status === 401) {
                errorMessage = 'Невірний ключ Microsoft Translator API. Перевірте його та спробуйте знову.';
            } else if (response.status === 403) {
                errorMessage = 'Недостатньо прав для Microsoft Translator API. Перевірте підписку Azure.';
            } else if (response.status === 429) {
                errorMessage = 'Перевищено ліміт запитів до Microsoft Translator API.';
            }
            
            throw new Error(errorMessage);
        }
        
        // Перевіряємо формат даних
        if (!Array.isArray(responseData) || responseData.length === 0 || 
            !responseData[0].translations || responseData[0].translations.length === 0) {
            throw new Error('Неочікуваний формат відповіді від Microsoft Translator API');
        }
        
        // Повертаємо перекладений текст
        return responseData[0].translations[0].text;
        
    } catch (error) {
        console.error('Помилка Microsoft Translator API:', error);
        throw error;
    }
}

function simulateTranslation(texts, sourceLang, targetLang) {
    // Цей метод залишається як запасний варіант або для тестування
    // В реальному додатку будуть використовуватися API перекладу
    
    // Simulate network delay
    return new Promise(resolve => {
        setTimeout(() => {
            const translatedTexts = texts.map(text => {
                if (!text.trim()) return text;
                
                // Determine language prefix to simulate translation
                let prefix = '';
                switch (targetLang) {
                    case 'en': prefix = 'EN: '; break;
                    case 'ru': prefix = 'RU: '; break;
                    case 'uk': prefix = 'UA: '; break;
                    case 'fr': prefix = 'FR: '; break;
                    case 'de': prefix = 'DE: '; break;
                    case 'es': prefix = 'ES: '; break;
                    default: prefix = `${targetLang.toUpperCase()}: `;
                }
                
                // Skip adding prefix if text already starts with a language prefix
                if (text.startsWith('EN: ') || text.startsWith('RU: ') || 
                    text.startsWith('UA: ') || text.startsWith('FR: ') || 
                    text.startsWith('DE: ') || text.startsWith('ES: ')) {
                    return text;
                }
                
                return prefix + text;
            });
            
            resolve(translatedTexts);
        }, 300);
    });
}

function reconstructFile(translatedTexts, structure, parsedFile) {
    document.getElementById('status-message').textContent = 'Создание переведенного файла...';
    
    let result;
    
    switch (parsedFile.type) {
        case 'json':
            result = reconstructJSON(translatedTexts, structure, parsedFile.data);
            break;
        case 'xml':
            result = reconstructXML(translatedTexts, structure, parsedFile.data);
            break;
        case 'csv':
            result = reconstructCSV(translatedTexts, structure, parsedFile.data);
            break;
        default:
            result = reconstructText(translatedTexts, structure);
    }
    
    return result;
}

function reconstructJSON(translatedTexts, structure, originalData) {
    // Create a deep copy of the original data
    const result = JSON.parse(JSON.stringify(originalData));
    
    structure.forEach((item, index) => {
        let currentObj = result;
        const translatedText = reinsertTags(translatedTexts[index], item.tags);
        
        // Handle array indices and nested properties
        const keyParts = item.key.split(/\.|\[|\]/g).filter(part => part !== '');
        
        for (let i = 0; i < keyParts.length - 1; i++) {
            const part = keyParts[i];
            if (!isNaN(part)) {
                // Array index
                currentObj = currentObj[parseInt(part)];
            } else {
                // Object property
                currentObj = currentObj[part];
            }
        }
        
        const lastKey = keyParts[keyParts.length - 1];
        if (!isNaN(lastKey)) {
            // Array index
            currentObj[parseInt(lastKey)] = translatedText;
        } else {
            // Object property
            currentObj[lastKey] = translatedText;
        }
    });
    
    return JSON.stringify(result, null, 2);
}

function reconstructXML(translatedTexts, structure, xmlDoc) {
    structure.forEach((item, index) => {
        if (item.type === 'xml-text') {
            const translatedText = reinsertTags(translatedTexts[index], item.tags);
            item.originalNode.nodeValue = translatedText;
        }
    });
    
    // Serialize XML back to string
    const serializer = new XMLSerializer();
    return serializer.serializeToString(xmlDoc);
}

function reconstructCSV(translatedTexts, structure, originalData) {
    const result = JSON.parse(JSON.stringify(originalData)); // Deep copy
    
    structure.forEach((item, index) => {
        if (item.type === 'csv-cell') {
            const [rowIndex, colIndex] = item.key.split(',').map(Number);
            const translatedText = reinsertTags(translatedTexts[index], item.tags);
            result[rowIndex][colIndex] = translatedText;
        }
    });
    
    // Convert back to CSV
    return result.map(row => row.join(',')).join('\n');
}

function reconstructText(translatedTexts, structure) {
    const result = [];
    
    console.log("Початок реконструкції тексту...");
    
    structure.forEach((item, index) => {
        console.log(`Обробка елемента ${index}, тип: ${item.type}`);
        
        if (item.type === 'empty') {
            // Порожній рядок
            result.push('');
        } else if (item.type === 'section-header') {
            // Заголовок секції, не перекладається
            result.push(item.originalLine);
        } else if (item.type === 'localization-key') {
            // Локалізаційний ключ типу CIN_Intro_01="текст"
            const translatedText = reinsertTags(translatedTexts[index], item.tags);
            // Формуємо рядок з оригінальним ключем
            result.push(`${item.locKey}="${translatedText}"`);
        } else if (item.type === 'key-value-no-translate') {
            // Ключ-значення, яке не потребує перекладу
            if (item.hasQuotes) {
                result.push(`${item.originalKey}${item.separator}"${item.originalValue}"`);
            } else {
                result.push(`${item.originalKey}${item.separator}${item.originalValue}`);
            }
        } else if (item.type === 'line') {
            // Звичайний рядок тексту
            const translatedText = reinsertTags(translatedTexts[index], item.tags);
            result.push(translatedText);
        } else if (item.type === 'key-value') {
            // Звичайний ключ-значення
            const translatedText = reinsertTags(translatedTexts[index], item.tags);
            
            if (item.hasQuotes) {
                result.push(`${item.originalKey}${item.separator}"${translatedText}"`);
            } else {
                result.push(`${item.originalKey}${item.separator}${translatedText}`);
            }
        }
    });
    
    const finalText = result.join('\n');
    console.log("Фінальний текст після реконструкції:");
    
    return finalText;
}

function reinsertTags(translatedText, tags) {
    // Функція відновлює теги у перекладеному тексті
    console.log("Відновлення тегів у тексті:", translatedText);
    
    if (!tags || tags.length === 0) {
        console.log("Немає тегів для відновлення");
        return translatedText;
    }
    
    console.log("Теги для відновлення:", tags);
    
    // Копія тексту для обробки
    let result = translatedText;
    
    // Заміна всіх тегових плейсхолдерів назад на їх оригінальні значення
    for (let i = 0; i < tags.length; i++) {
        const tagPlaceholder = `__LOCTAG_${i}__`;
        const originalValue = tags[i].value;
        
        // Перевіряємо чи є цей тег у перекладеному тексті
        if (result.includes(tagPlaceholder)) {
            console.log(`Заміняємо тег ${tagPlaceholder} на ${originalValue}`);
            
            // Використовуємо цикл while для заміни всіх входжень плейсхолдера
            while (result.includes(tagPlaceholder)) {
                result = result.replace(tagPlaceholder, originalValue);
            }
        } else {
            console.warn(`Тег ${tagPlaceholder} відсутній у перекладеному тексті!`);
        }
    }
    
    // Перевірка на залишкові теги
    if (result.includes('__LOCTAG_')) {
        const remainingTags = [];
        const tagRegex = /__LOCTAG_(\d+)__/g;
        let match;
        
        while ((match = tagRegex.exec(result)) !== null) {
            remainingTags.push(match[0]);
        }
        
        console.error("УВАГА! Знайдено незамінені теги:", remainingTags);
    } else {
        console.log("Всі теги успішно замінені");
    }
    
    console.log("Фінальний текст з відновленими тегами:", result);
    return result;
}

// Функція для валідації API ключів різних сервісів
function validateApiKey(api, key) {
    if (!key || key.trim() === '') {
        return { 
            valid: false, 
            message: 'API ключ не может быть пустым' 
        };
    }
    
    switch (api) {
        case 'google':
            // Google API ключі зазвичай містять алфавітно-цифрові символи і довжиною 39 символів
            if (!/^[A-Za-z0-9-_]{39}$/.test(key)) {
                return { 
                    valid: false, 
                    message: 'Google API ключ должен быть длиной 39 символов и содержать только буквы, цифры, дефисы и подчеркивания' 
                };
            }
            break;
            
        case 'deepl':
            // DeepL Free API ключі закінчуються на :fx, а Pro не мають цього суфіксу
            if (!(
                /^[A-Za-z0-9]+:fx$/.test(key) || // Free API key
                /^[A-Za-z0-9]+$/.test(key)      // Pro API key
            )) {
                return { 
                    valid: false, 
                    message: 'DeepL API ключ должен содержать только буквы и цифры. Free API ключ должен заканчиваться на ":fx"' 
                };
            }
            break;
            
        case 'microsoft':
            // Microsoft Translator ключі зазвичай довші 30 символів і мають лише алфавітно-цифрові символи
            if (key.length < 30 || !/^[A-Za-z0-9]+$/.test(key)) {
                return { 
                    valid: false, 
                    message: 'Microsoft Translator API ключ должен быть длиной не менее 30 символов и содержать только буквы и цифры' 
                };
            }
            break;
    }
    
    return { valid: true };
}

// Функція для отримання назви API для відображення
function getApiName(api) {
    switch (api) {
        case 'google': return 'Google Translate API';
        case 'deepl': return 'DeepL API';
        case 'microsoft': return 'Microsoft Translator API';
        default: return api;
    }
}

// Helper function to adjust language codes for Google
function adjustGoogleLanguageCode(langCode) {
    const mappings = {
        'zh': 'zh-CN',  // Default Chinese to Simplified Chinese
        'zh-TW': 'zh-TW' // Traditional Chinese
        // Add other mappings as needed
    };
    
    return mappings[langCode] || langCode;
}

// Helper function to adjust language codes for DeepL
function adjustDeepLLanguageCode(langCode) {
    const mappings = {
        'zh': 'ZH',       // Default Chinese to Simplified Chinese
        'zh-CN': 'ZH',    // Simplified Chinese
        'zh-TW': 'ZH',    // DeepL doesn't distinguish, use ZH
        'en': 'EN-US',    // Default English to US English
        'en-US': 'EN-US', // US English
        'en-GB': 'EN-GB', // British English
        'pt': 'PT-PT',    // European Portuguese
        'pt-BR': 'PT-BR'  // Brazilian Portuguese
        // Add other mappings as needed
    };
    
    return mappings[langCode] || langCode.toUpperCase();
}