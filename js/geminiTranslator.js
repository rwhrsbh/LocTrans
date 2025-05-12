// Gemini AI translation handling

async function handleGeminiTranslation() {
    const files = document.getElementById('gemini-file').files;
    const apiKey = document.getElementById('api-key').value.trim();
    
    if (files.length === 0 || !apiKey) return;
    
    const sourceLang = document.getElementById('gemini-source-lang').value;
    const targetLang = document.getElementById('gemini-target-lang').value;
    const selectedModel = document.getElementById('gemini-model').value;
    
    showResultContainer();
    
    // Сброс цвета прогресс-бара к исходному при каждом новом запуске
    document.getElementById('progress-bar').style.backgroundColor = 'var(--secondary-color)';
    
    // Проверяем наличие элемента для сообщений о лимите
    let limitMessageElement = document.getElementById('api-limit-message');
    if (!limitMessageElement) {
        // Создаем элемент, если его нет
        limitMessageElement = document.createElement('p');
        limitMessageElement.id = 'api-limit-message';
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
        // Check word count
        const wordCountElement = document.getElementById('word-limit-counter');
        const wordCount = parseInt(wordCountElement.textContent.replace(/,/g, ''));
        
        if (wordCount > 1000000) {
            throw new Error('Превышен лимит слов (1,000,000). Пожалуйста, используйте файлы меньшего размера.');
        }
        
        // Массивы для хранения результатов
        const translatedContents = [];
        const fileNames = [];
        const fileTypes = [];
        
        // Обновляем статус с общим количеством файлов
        document.getElementById('status-message').textContent = `Обработка файлов (0/${files.length})...`;
        
        // Общее количество пакетов для всех файлов (для подсчета прогресса)
        let totalBatches = 0;
        let completedBatches = 0;
        
        // Обрабатываем каждый файл
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Обновляем прогресс обработки файлов (30% от общего прогресса)
            const fileProcessingPercent = (i / files.length) * 30;
            document.getElementById('progress-bar').style.width = `${fileProcessingPercent}%`;
            document.getElementById('status-message').textContent = `Обработка файлов (${i+1}/${files.length})...`;
            
            try {
                // Parse the file
                const parsedFile = await parseFile(file);
                
                // Extract texts for translation while preserving keys and tags
                const { textsToTranslate, structure } = extractTranslatableTexts(parsedFile);
                
                // Translate the texts using Gemini AI
                const translatedTexts = await translateWithGemini(
                    textsToTranslate, 
                    sourceLang, 
                    targetLang, 
                    apiKey, 
                    selectedModel, 
                    i + 1, 
                    files.length,
                    totalBatches,
                    completedBatches
                );
                
                // Обновляем счетчики пакетов для следующего файла
                if (textsToTranslate.length > 0) {
                    const nonEmptyTexts = textsToTranslate.filter(text => text.trim());
                    const batchSize = 50; // Такой же как в translateWithGemini
                    const fileBatches = Math.ceil(nonEmptyTexts.length / batchSize);
                    totalBatches += fileBatches;
                    completedBatches += fileBatches;
                }
                
                // Reconstruct the file with translated texts
                const translatedContent = reconstructFile(translatedTexts, structure, parsedFile);
                
                // Сохраняем результаты
                translatedContents.push(translatedContent);
                fileNames.push(file.name);
                fileTypes.push(parsedFile.type);
            } catch (error) {
                // Проверяем, связана ли ошибка с дневным лимитом
                if (error.message && error.message.includes('Дневной лимит API Gemini исчерпан')) {
                    // Останавливаем весь процесс с ошибкой дневного лимита
                    throw error;
                }
                
                // Для временных ошибок лимита, продолжаем выполнение после ожидания
                if (error.message && (
                    error.message.includes('Превышен лимит запросов API') || 
                    error.message.includes('Resource has been exhausted') ||
                    error.message.includes('RESOURCE_EXHAUSTED'))) {
                    
                    // Уменьшаем индекс, чтобы повторить этот файл
                    i--;
                    
                    // Показываем сообщение о временном превышении лимита в отдельном параграфе
                    document.getElementById('api-limit-message').textContent = 
                        `Превышен лимит API. Ожидаем 1 минуту перед продолжением...`;
                    document.getElementById('api-limit-message').style.display = 'block';
                    
                    // Ждем 1 минуту
                    await new Promise(resolve => setTimeout(resolve, 60000));
                    
                    // Скрываем сообщение о лимите
                    document.getElementById('api-limit-message').style.display = 'none';
                    
                    // Продолжаем выполнение
                    continue;
                }
                
                // Обрабатываем другие ошибки для данного файла
                console.error(`Ошибка при обработке файла ${file.name}:`, error);
                document.getElementById('status-message').textContent = 
                    `Предупреждение: Не удалось обработать файл ${file.name}: ${error.message || error}`;
                
                // Небольшая пауза, чтобы пользователь мог прочитать сообщение об ошибке
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // Продолжаем с другими файлами
                continue;
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
        document.getElementById('status-message').textContent = `Перевод завершен! Обработано файлов: ${translatedContents.length} из ${files.length}`;
        document.getElementById('download-container').classList.remove('hidden');
        
        // Скрываем сообщение о лимите, если оно отображалось
        document.getElementById('api-limit-message').style.display = 'none';
        
    } catch (error) {
        document.getElementById('status-message').textContent = `Ошибка: ${error.message || error}`;
        document.getElementById('progress-bar').style.width = '100%';
        document.getElementById('progress-bar').style.backgroundColor = 'var(--error-color)';
        
        // Скрываем сообщение о лимите
        document.getElementById('api-limit-message').style.display = 'none';
    }
}

async function translateWithGemini(texts, sourceLang, targetLang, apiKey, model, currentFileNum, totalFiles, totalBatchesProcessed, completedBatchesTotal) {
    // Update status
    document.getElementById('status-message').textContent = `Файл ${currentFileNum}/${totalFiles}: Подготовка к переводу через Gemini AI...`;
    document.getElementById('progress-bar').style.width = `${30 + ((currentFileNum - 1) / totalFiles) * 50}%`;
    
    // Filter out empty texts
    const nonEmptyTexts = texts.filter(text => text.trim());
    const emptyIndices = texts.map((text, index) => text.trim() ? null : index).filter(index => index !== null);
    
    // Prepare translated results array (including empties)
    const translatedTexts = [...texts];
    
    if (nonEmptyTexts.length === 0) {
        return translatedTexts; // Nothing to translate
    }
    
    // Batch texts for translation to avoid request size limits
    const batchSize = 50; // Adjust based on API limitations
    const batches = [];
    
    for (let i = 0; i < nonEmptyTexts.length; i += batchSize) {
        batches.push(nonEmptyTexts.slice(i, i + batchSize));
    }
    
    document.getElementById('status-message').textContent = 
        `Файл ${currentFileNum}/${totalFiles}: Перевод через Gemini AI (0/${batches.length} пакетов)...`;
    
    // Определяем максимальное количество запросов в минуту в зависимости от модели
    const maxConcurrent = model === 'gemini-2.0-flash-lite' ? 20 : 30;
    
    // Функция для ограничения количества одновременных запросов
    async function throttleRequests(requests, intervalMs = 60000) {
        const results = new Array(requests.length);
        let activeRequests = 0;
        let completedRequests = 0;
        let nextRequestIndex = 0;
        let lastIntervalStart = Date.now();
        let requestsInCurrentInterval = 0;
        let isWaitingForNewInterval = false;
        let isPausedForQuotaLimit = false;
        
        return new Promise((resolve) => {
            // Функция для запуска следующего запроса
            async function startNextRequest() {
                // Если система приостановлена из-за квоты, не запускаем новых запросов
                if (isPausedForQuotaLimit) {
                    setTimeout(startNextRequest, 1000); // Проверяем каждую секунду
                    return;
                }
                
                // Проверяем ограничение по времени (30/20 запросов в минуту)
                const now = Date.now();
                if (now - lastIntervalStart >= intervalMs) {
                    // Начинаем новый интервал
                    lastIntervalStart = now;
                    requestsInCurrentInterval = 0;
                    isWaitingForNewInterval = false;
                    
                    // Скрываем сообщение о лимите
                    document.getElementById('api-limit-message').style.display = 'none';
                }
                
                // Если достигли лимита запросов в текущем интервале, ждем начала нового интервала
                if (requestsInCurrentInterval >= maxConcurrent) {
                    const timeToWait = intervalMs - (now - lastIntervalStart);
                    if (timeToWait > 0) {
                        isWaitingForNewInterval = true;
                        // Показываем пользователю, что мы ждем из-за лимита API в отдельном параграфе
                        document.getElementById('api-limit-message').textContent = 
                            `Достигнут лимит API (${maxConcurrent} запросов/мин). Ожидание: ${Math.ceil(timeToWait/1000)} сек...`;
                        document.getElementById('api-limit-message').style.display = 'block';
                        
                        setTimeout(startNextRequest, timeToWait + 100); // Добавляем 100мс для надежности
                        return;
                    }
                    // Начинаем новый интервал
                    lastIntervalStart = Date.now();
                    requestsInCurrentInterval = 0;
                    isWaitingForNewInterval = false;
                    
                    // Скрываем сообщение о лимите
                    document.getElementById('api-limit-message').style.display = 'none';
                }
                
                // Если все запросы запущены, выходим
                if (nextRequestIndex >= requests.length) return;
                
                const currentIndex = nextRequestIndex++;
                const batch = batches[currentIndex];
                activeRequests++;
                requestsInCurrentInterval++;
                
                // Обновляем UI с информацией о прогрессе
                // Учитываем прогресс текущего файла и всех предыдущих файлов
                const totalProgressPercent = 30 + (
                    ((currentFileNum - 1) / totalFiles) * 50 + // Прогресс предыдущих файлов
                    (completedRequests / batches.length) * (50 / totalFiles) // Прогресс текущего файла
                );
                
                document.getElementById('progress-bar').style.width = `${totalProgressPercent}%`;
                
                if (!isWaitingForNewInterval && !isPausedForQuotaLimit) {
                    document.getElementById('status-message').textContent = 
                        `Файл ${currentFileNum}/${totalFiles}: Перевод через Gemini AI (${completedRequests}/${batches.length} пакетов, ${activeRequests} активных)...`;
                }
                
                try {
                    // Выполняем запрос
                    const result = await translateBatchWithGemini(batch, sourceLang, targetLang, apiKey, model);
                    results[currentIndex] = result; // Сохраняем результат в правильном порядке
                } catch (error) {
                    console.error(`Ошибка в пакете ${currentIndex}:`, error);
                    
                    // Если ошибка связана с дневным лимитом, останавливаем все запросы
                    if (error.message && error.message.includes('Дневной лимит API Gemini исчерпан')) {
                        document.getElementById('status-message').textContent = error.message;
                        document.getElementById('progress-bar').style.backgroundColor = 'var(--error-color)';
                        
                        // Скрываем сообщение о лимите
                        document.getElementById('api-limit-message').style.display = 'none';
                        
                        // Не запускаем больше новых запросов
                        nextRequestIndex = requests.length;
                        throw error; // Пробрасываем ошибку, чтобы остановить всю цепочку
                    }
                    
                    // При временном превышении лимита запросов приостанавливаем обработку
                    if (error.message && (
                        error.message.includes('Превышен лимит запросов API') || 
                        error.message.includes('Resource has been exhausted') ||
                        error.message.includes('RESOURCE_EXHAUSTED'))) {
                        
                        // Возвращаем индекс назад, чтобы повторить этот запрос позже
                        nextRequestIndex--;
                        
                        // Отмечаем, что система приостановлена из-за лимита
                        isPausedForQuotaLimit = true;
                        
                        // Показываем сообщение о лимите в отдельном параграфе
                        document.getElementById('api-limit-message').textContent = 
                            `Превышен лимит API. Ожидание 1 минуту перед продолжением...`;
                        document.getElementById('api-limit-message').style.display = 'block';
                        
                        setTimeout(() => {
                            // Сбрасываем флаг паузы и продолжаем обработку
                            isPausedForQuotaLimit = false;
                            requestsInCurrentInterval = 0;
                            lastIntervalStart = Date.now();
                            
                            // Скрываем сообщение о лимите
                            document.getElementById('api-limit-message').style.display = 'none';
                            
                            // Возобновляем обработку
                            startNextRequest();
                        }, 60000);
                        
                        return; // Прекращаем дальнейшие действия для этого вызова
                    }
                    
                    // Для остальных ошибок используем оригинальный текст
                    results[currentIndex] = batch;
                }
                
                // Обновляем счетчики и прогресс
                activeRequests--;
                completedRequests++;
                completedBatchesTotal++;
                
                const newTotalProgressPercent = 30 + (
                    ((currentFileNum - 1) / totalFiles) * 50 + // Прогресс предыдущих файлов
                    (completedRequests / batches.length) * (50 / totalFiles) // Прогресс текущего файла
                );
                
                document.getElementById('progress-bar').style.width = `${newTotalProgressPercent}%`;
                
                if (!isWaitingForNewInterval && !isPausedForQuotaLimit) {
                    document.getElementById('status-message').textContent = 
                        `Файл ${currentFileNum}/${totalFiles}: Перевод через Gemini AI (${completedRequests}/${batches.length} пакетов, ${activeRequests} активных)...`;
                }
                
                // Запускаем следующий запрос
                startNextRequest();
                
                // Если все запросы завершены, разрешаем промис
                if (completedRequests === batches.length) {
                    resolve(results);
                }
            }
            
            // Запускаем начальные запросы (до maxConcurrent)
            const initialBatchCount = Math.min(maxConcurrent, batches.length);
            for (let i = 0; i < initialBatchCount; i++) {
                startNextRequest();
            }
        });
    }
    
    // Запускаем параллельные запросы с ограничением
    const batchResults = await throttleRequests(batches);
    
    // Объединяем результаты всех пакетов
    const translatedBatches = batchResults.flat();
    
    // Reinsert translations into the original array structure (preserving empty strings)
    let nonEmptyIndex = 0;
    for (let i = 0; i < translatedTexts.length; i++) {
        if (!emptyIndices.includes(i)) {
            translatedTexts[i] = translatedBatches[nonEmptyIndex];
            nonEmptyIndex++;
        }
    }
    
    // Обновляем прогресс с учетом всех файлов
    const fileCompletionPercent = 30 + (currentFileNum / totalFiles) * 50;
    document.getElementById('progress-bar').style.width = `${fileCompletionPercent}%`;
    document.getElementById('status-message').textContent = `Файл ${currentFileNum}/${totalFiles}: Завершаем перевод...`;
    
    // Скрываем сообщение о лимите, если оно отображалось
    document.getElementById('api-limit-message').style.display = 'none';
    
    return translatedTexts;
}

async function translateBatchWithGemini(textBatch, sourceLang, targetLang, apiKey, model) {
    const languageNames = {
        'en': 'English',
        'ru': 'Russian',
        'uk': 'Ukrainian',
        'fr': 'French',
        'de': 'German',
        'es': 'Spanish',
        'it': 'Italian',
        'pt': 'Portuguese',
        'zh': 'Chinese',
        'ja': 'Japanese',
        'ko': 'Korean'
    };
    
    const sourceLanguage = languageNames[sourceLang] || sourceLang;
    const targetLanguage = languageNames[targetLang] || targetLang;
    
    // Prepare prompt for Gemini
    const prompt = `
    I need you to translate the following texts from ${sourceLanguage} to ${targetLanguage}.
    Important: 
    1. Only translate the text, do not add any explanations or notes
    2. Keep all placeholders intact (like __TAG0__, __TAG1__, etc)
    3. For each numbered text, provide only the translation
    4. Maintain the same tone and formality as the original text

    Cultural adaptation instructions for ${targetLanguage}:
${getStyleForLanguage(targetLang)}

    
    Texts to translate:
    ${textBatch.map((text, index) => `[${index + 1}] ${text}`).join('\n')}
    
    Translations:
    `;
    
    // Добавляем повторные попытки для надежности
    const maxRetries = 2;
    let retryCount = 0;
    
    while (retryCount <= maxRetries) {
        try {
            return await realGeminiAPICall(textBatch, prompt, apiKey, targetLang, model);
        } catch (error) {
            retryCount++;
            console.error(`Gemini translation error (попытка ${retryCount}/${maxRetries + 1}):`, error);
            
            // Если это была последняя попытка, выбрасываем ошибку
            if (retryCount > maxRetries) {
                throw new Error(`Ошибка при переводе через Gemini AI: ${error.message || 'Неизвестная ошибка'}`);
            }
            
            // Иначе ждем перед следующей попыткой (экспоненциальная задержка)
            const delayMs = 1000 * Math.pow(2, retryCount - 1); // 1s, 2s, 4s...
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
}

function getStyleForLanguage(language) {
    const styleGuides = {
        'uk': `
            1. Use Ukrainian Cossack-style language patterns and expressions where appropriate for the context.
            2. Incorporate traditional Ukrainian cultural references and idioms naturally.
            3. Use authentic Ukrainian linguistic features instead of literal translations or calques.
            4. Adapt any metaphors or expressions to match Ukrainian cultural context.
            5. Consider using archaic or traditional Ukrainian words where it enhances cultural authenticity and fits the tone.
            6. Include references to Ukrainian folk traditions, kozak heritage, and historical elements if relevant.
            7. Use distinctly Ukrainian grammatical structures.
        `,
        'ru': `
            1. Use rich, literary Russian vocabulary.
            2. Incorporate traditional Russian proverbs, sayings and cultural references appropriately.
            3. Use authentic Russian speech patterns and idiomatic expressions.
            4. Adapt imagery to reflect Russian cultural and historical contexts.
            5. Consider using occasional archaic Russian expressions for cultural depth if suitable for the text.
            6. Include references to Russian folklore, literature and traditional concepts where fitting.
            7. Maintain Russian syntax patterns that reflect the language's expressiveness.
        `,
         'fr': `
            1. Use elegant, sophisticated French expressions reflecting French cultural refinement.
            2. Incorporate distinctly French cultural references, idioms and literary allusions.
            3. Use authentic French linguistic structures and patterns of expression.
            4. Adapt metaphors to reflect French cultural sensibilities and aesthetic traditions.
            5. Consider using classically French turns of phrase that showcase the language's precision.
            6. Include subtle references to French art, cuisine, philosophy and cultural values.
            7. Maintain the characteristic cadence and rhythm of French language.
        `,
        'de': `
            1. Use precise, structured German expressions with proper compound constructions.
            2. Incorporate German cultural references, philosophical concepts and traditional wisdom.
            3. Use authentic German sentence structures rather than translated patterns.
            4. Adapt imagery to reflect German cultural sensibilities and historical context.
            5. Consider using regional expressions that add cultural authenticity when appropriate.
            6. Include references to German intellectual traditions, folklore and cultural concepts.
            7. Maintain German precision in vocabulary choice with attention to nuanced meanings.
        `,
        'es': `
            1. Use vibrant, expressive Spanish with regional color depending on target audience.
            2. Incorporate Hispanic cultural references, proverbs and idiomatic expressions.
            3. Use authentic Spanish linguistic patterns including proper subjunctive usage.
            4. Adapt metaphors to reflect Hispanic cultural contexts and traditions.
            5. Consider using distinctive Spanish expressions that reflect the language's warmth.
            6. Include references to Hispanic literary traditions, cultural celebrations and values.
            7. Maintain the musical flow and emotional expressiveness of Spanish language.
        `,
        'it': `
            1. Use expressive, melodic Italian with attention to its musical qualities.
            2. Incorporate Italian cultural references, gestures, and traditional expressions.
            3. Use authentic Italian linguistic features including diminutives and augmentatives.
            4. Adapt imagery to reflect Italian cultural sensibilities and regional traditions.
            5. Consider using expressions that reflect Italian emotional expressiveness.
            6. Include references to Italian art, cuisine, family values and cultural heritage.
            7. Maintain the characteristic rhythm and emphasis patterns of Italian speech.
        `,
        'pl': `
            1. Use distinctive Polish expressions with proper case usage and grammatical gender.
            2. Incorporate Polish cultural references, historical allusions and traditional sayings.
            3. Use authentic Polish linguistic features including diminutive forms.
            4. Adapt metaphors to reflect Polish cultural contexts and national experiences.
            5. Consider using expressions that reflect Polish resilience and cultural identity.
            6. Include references to Polish traditions, literature, and historical consciousness.
            7. Maintain the characteristic syntax and word order of Polish language.
        `,
        'ja': `
            1. Use appropriate Japanese honorifics and keigo (politeness levels) for the context.
            2. Incorporate Japanese cultural concepts, references to nature, and seasonal awareness.
            3. Use authentic Japanese expressions including proper onomatopoeia and mimetic words.
            4. Adapt imagery to reflect Japanese aesthetic sensibilities and cultural values.
            5. Consider using expressions that reflect Japanese indirectness and context-sensitivity.
            6. Include references to Japanese traditions, cultural practices and philosophical concepts.
            7. Maintain proper sentence structures with appropriate particles and verb endings.
        `,
        'zh': `
            1. Use appropriate Chinese expressions with attention to the four-character idioms (chengyu).
            2. Incorporate Chinese cultural references, philosophical concepts and traditional wisdom.
            3. Use authentic Chinese metaphors and figurative language rooted in Chinese history.
            4. Adapt imagery to reflect Chinese cultural perspectives and traditional values.
            5. Consider using expressions that reflect Chinese conceptual thinking and worldview.
            6. Include references to Chinese literary traditions, cultural practices and historical context.
            7. Maintain appropriate formality levels and respectful language patterns.
        `,
        'ar': `
            1. Use rich Arabic expressions with proper rhetorical devices and linguistic patterns.
            2. Incorporate Arab cultural references, poetic allusions and traditional wisdom.
            3. Use authentic Arabic linguistic features including proper plural forms and dual case.
            4. Adapt metaphors to reflect Arabic cultural contexts and desert/pastoral imagery.
            5. Consider using expressions that reflect Arabic eloquence and rhetorical tradition.
            6. Include references to Arabic literary heritage, cultural values and historical context.
            7. Maintain characteristic Arabic sentence structures and conjunction patterns.
        `
    };
    return styleGuides[language] || 'Translate naturally while respecting cultural context and linguistic patterns specific to the target language. Ensure the translation is accurate and fluent.';
}

// Функция для перевода с использованием Gemini API через XMLHttpRequest
async function realGeminiAPICall(textBatch, prompt, apiKey, targetLang, model) {
    // Максимальное количество повторных попыток при ошибке лимита
    const maxQuotaRetries = 3;
    let quotaRetryCount = 0;
    
    while (quotaRetryCount < maxQuotaRetries) {
        try {
            return await new Promise((resolve, reject) => {
                // Создаем XMLHttpRequest объект
                const xhr = new XMLHttpRequest();
                xhr.open('POST', `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, true);
                xhr.setRequestHeader('Content-Type', 'application/json');
                
                xhr.onload = function() {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const data = JSON.parse(xhr.responseText);
                            
                            // Проверяем структуру ответа
                            if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts) {
                                throw new Error('Неожиданный формат ответа API');
                            }
                            
                            const generatedText = data.candidates[0].content.parts[0].text;
                            
                            // Обрабатываем ответ, извлекая переводы
                            const translations = new Array(textBatch.length);
                            const lines = generatedText.split('\n');
                            
                            for (const line of lines) {
                                // Ищем строки вида "[1] перевод" или "1. перевод"
                                const match = line.match(/^\[(\d+)\]\s+(.+)$/) || line.match(/^(\d+)\.\s+(.+)$/);
                                if (match) {
                                    const index = parseInt(match[1]) - 1;
                                    if (index >= 0 && index < textBatch.length) {
                                        translations[index] = match[2];
                                    }
                                }
                            }
                            
                            // Проверяем, что все переводы были получены
                            const missingTranslations = translations.findIndex(t => t === undefined);
                            if (missingTranslations >= 0) {
                                console.warn(`Не удалось найти перевод для индекса ${missingTranslations}. Используем оригинальный текст.`);
                                // Заполняем пропущенные переводы
                                for (let i = 0; i < translations.length; i++) {
                                    if (translations[i] === undefined) {
                                        translations[i] = textBatch[i];
                                    }
                                }
                            }
                            
                            resolve(translations);
                        } catch (error) {
                            console.error('Ошибка обработки ответа:', error);
                            reject(new Error('Ошибка обработки ответа: ' + error.message));
                        }
                    } else {
                        try {
                            const errorData = JSON.parse(xhr.responseText);
                            
                            // Проверяем на ошибку превышения лимита (код 429)
                            if (xhr.status === 429 || 
                                (errorData.error && 
                                 (errorData.error.code === 429 || 
                                  errorData.error.status === 'RESOURCE_EXHAUSTED'))) {
                                
                                reject({
                                    isQuotaError: true,
                                    message: errorData.error?.message || 'Превышен лимит запросов API'
                                });
                            } else {
                                const errorMessage = errorData.error?.message || `API вернул статус: ${xhr.status}`;
                                reject(new Error(errorMessage));
                            }
                        } catch (e) {
                            reject(new Error(`Ошибка запроса: ${xhr.status}`));
                        }
                    }
                };
                
                xhr.onerror = function() {
                    reject(new Error('Сетевая ошибка при подключении к API'));
                };
                
                // Подготавливаем данные запроса
                const requestData = {
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.2,  // Низкая температура для более точных переводов
                        maxOutputTokens: model === 'gemini-2.0-flash-lite' ? 20192 : 30192  // Устанавливаем лимит токенов в зависимости от модели
                    }
                };
                
                // Добавляем конфигурацию синкинга для Gemini 2.5 Flash
                if (model === 'gemini-2.5-flash-preview-04-17') {
                    const enableThinking = document.getElementById('enable-thinking').checked;
                    // Add thinkingConfig *inside* generationConfig
                    requestData.generationConfig.thinkingConfig = {
                        thinkingBudget: enableThinking ? 2000 : 0, // Use the value from the checkbox
                    };
                }
                
                const requestBody = JSON.stringify(requestData);
                
                xhr.send(requestBody);
            });
        } catch (error) {
            // Проверяем, является ли это ошибкой превышения лимита
            if (error.isQuotaError) {
                quotaRetryCount++;
                
                // Если это последняя попытка, сообщаем о дневном лимите
                if (quotaRetryCount >= maxQuotaRetries) {
                    throw new Error('Дневной лимит API Gemini исчерпан. Пожалуйста, попробуйте завтра или используйте другой API ключ.');
                }
                
                // Обновляем статус для пользователя в отдельном параграфе
                document.getElementById('api-limit-message').textContent = 
                    `Превышен лимит API. Ожидаем 1 минуту... Попытка ${quotaRetryCount} из ${maxQuotaRetries}`;
                document.getElementById('api-limit-message').style.display = 'block';
                
                // Ждем 1 минуту перед следующей попыткой
                await new Promise(resolve => setTimeout(resolve, 60000));
                
                // Обновляем статус перед продолжением
                document.getElementById('api-limit-message').style.display = 'none';
                document.getElementById('status-message').textContent = 
                    `Продолжаем перевод после ожидания (попытка ${quotaRetryCount} из ${maxQuotaRetries})...`;
                
                // Продолжаем цикл для повторной попытки
                continue;
            }
            
            // Если это не ошибка превышения лимита, просто пробрасываем дальше
            throw error;
        }
    }
}

// Функция для обработки Markdown файлов
function extractFromMarkdown(lines) {
    let textsToTranslate = [];
    let structure = [];
    
    // Додаємо дебаг інформацію
    console.log("Розпочинаємо обробку Markdown файлу, рядків:", lines.length);
    
    // Відстежуємо, чи ми знаходимося всередині блоку коду
    let insideCodeBlock = false;
    
    lines.forEach((line, index) => {
        console.log(`Обробка рядка ${index}:`, line);
        
        if (line && line.trim()) {
            // Перевіряємо на початок або кінець блоку коду (```...)
            if (/^```.*$/.test(line.trim())) {
                console.log(`Рядок ${index} є початком або кінцем блоку коду Markdown`);
                insideCodeBlock = !insideCodeBlock; // перемикаємо стан
                textsToTranslate.push('');
                structure.push({ 
                    key: `${index}`, 
                    type: 'md-code-block', 
                    originalLine: line
                });
                return;
            }
            
            // Якщо ми всередині блоку коду, не перекладаємо цей рядок
            if (insideCodeBlock) {
                console.log(`Рядок ${index} є частиною блоку коду, не перекладаємо`);
                textsToTranslate.push('');
                structure.push({ 
                    key: `${index}`, 
                    type: 'md-code-content', 
                    originalLine: line
                });
                return;
            }
            
            // Перевіряємо на MD заголовки (# Heading)
            if (/^#{1,6}\s+.+/.test(line.trim())) {
                console.log(`Рядок ${index} є Markdown заголовком`);
                // Розділяємо на маркер заголовка і текст
                const match = line.match(/^(#{1,6}\s+)(.+)$/);
                if (match) {
                    const headingMarker = match[1]; // частина з #
                    const headingText = match[2]; // текст заголовка
                    
                    // Перекладаємо лише текст заголовка
                    const { text, tags } = extractTags(headingText);
                    textsToTranslate.push(text);
                    structure.push({ 
                        key: `${index}`, 
                        type: 'md-heading', 
                        headingMarker: headingMarker,
                        tags: tags
                    });
                    return;
                }
            }
            
            // Перевіряємо на inline код (`code`)
            let processedLine = line;
            const inlineCodeTags = [];
            let inlineCodeCount = 0;
            
            // Замінюємо inline код на плейсхолдери
            processedLine = processedLine.replace(/`[^`]+`/g, (match) => {
                const placeholder = `__MD_CODE_${inlineCodeCount}__`;
                inlineCodeTags.push(match);
                inlineCodeCount++;
                return placeholder;
            });
            
            // Обробляємо звичайний текст
            const { text, tags } = extractTags(processedLine);
            textsToTranslate.push(text);
            
            structure.push({ 
                key: `${index}`, 
                type: 'md-line', 
                tags: tags,
                inlineCodeTags: inlineCodeTags
            });
        } else {
            // Порожній рядок
            console.log(`Порожній рядок`);
            textsToTranslate.push('');
            structure.push({ key: `${index}`, type: 'empty' });
        }
    });
    
    console.log("Структура тексту після обробки:", structure);
    console.log("Тексти для перекладу:", textsToTranslate);
    
    return { textsToTranslate, structure };
}

// Додаємо підтримку MD до функції reconstructFile
function reconstructFile(translatedTexts, structure, parsedFile) {
    let translatedContent;
    
    switch (parsedFile.type) {
        case 'json':
            translatedContent = reconstructJSON(translatedTexts, structure, parsedFile.data);
            break;
        case 'xml':
            translatedContent = reconstructXML(translatedTexts, structure, parsedFile.data);
            break;
        case 'csv':
            translatedContent = reconstructCSV(translatedTexts, structure, parsedFile.data);
            break;
        case 'md':
            translatedContent = reconstructMarkdown(translatedTexts, structure, parsedFile.data);
            break;
        default:
            translatedContent = reconstructText(translatedTexts, structure);
    }
    
    return translatedContent;
}

// Додаємо функцію для реконструкції MD файлів
function reconstructMarkdown(translatedTexts, structure) {
    const result = [];
    
    console.log("Початок реконструкції Markdown тексту...");
    
    structure.forEach((item, index) => {
        console.log(`Обробка елемента ${index}, тип: ${item.type}`);
        
        if (item.type === 'empty') {
            // Порожній рядок
            result.push('');
        } else if (item.type === 'md-heading') {
            // Markdown заголовок
            const translatedText = reinsertTags(translatedTexts[index], item.tags);
            result.push(`${item.headingMarker}${translatedText}`);
        } else if (item.type === 'md-code-block' || item.type === 'md-code-content') {
            // Блоки коду не перекладаються
            result.push(item.originalLine);
        } else if (item.type === 'md-line') {
            // Звичайний рядок Markdown тексту
            let translatedText = reinsertTags(translatedTexts[index], item.tags);
            
            // Відновлюємо inline код
            if (item.inlineCodeTags && item.inlineCodeTags.length > 0) {
                for (let i = 0; i < item.inlineCodeTags.length; i++) {
                    const placeholder = `__MD_CODE_${i}__`;
                    translatedText = translatedText.replace(placeholder, item.inlineCodeTags[i]);
                }
            }
            
            result.push(translatedText);
        }
    });
    
    const finalText = result.join('\n');
    console.log("Фінальний текст після реконструкції:");
    
    return finalText;
}

// Перед функцією extractFromMarkdown 
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
        case 'md':
            ({ textsToTranslate, structure } = extractFromMarkdown(parsedFile.data));
            break;
        default:
            ({ textsToTranslate, structure } = extractFromText(parsedFile.data));
    }
    
    return { textsToTranslate, structure };
}
