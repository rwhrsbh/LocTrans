document.addEventListener('DOMContentLoaded', () => {
    // Initialize languages
    initializeLanguages();
    
    // Tab switching
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });
    
    // Управление отображением опции синкинга в зависимости от выбранной модели
    const modelSelector = document.getElementById('gemini-model');
    const thinkingOptionContainer = document.getElementById('thinking-option-container');
    
    // Функция для обновления видимости опции синкинга
    function updateThinkingOptionVisibility() {
        if (modelSelector.value === 'gemini-2.5-flash-preview-04-17') {
            thinkingOptionContainer.style.display = 'flex';
        } else {
            thinkingOptionContainer.style.display = 'none';
        }
    }
    
    // Вызываем функцию при загрузке страницы
    updateThinkingOptionVisibility();
    
    // Добавляем обработчик события изменения модели
    modelSelector.addEventListener('change', updateThinkingOptionVisibility);
    
    // Управление информацией об API ключе в зависимости от выбранного API
    const translationApiSelector = document.getElementById('translation-api');
    const apiKeyInfo = document.getElementById('api-key-info');
    
    // Функция для обновления информации об API ключе
    function updateApiKeyInfo() {
        const apiType = translationApiSelector.value;
        
        switch (apiType) {
            case 'google':
                apiKeyInfo.innerHTML = 'Для Google Translate API нужен ключ из <a href="https://console.cloud.google.com/" target="_blank">Google Cloud Console</a>.<br>' +
                                      'Активируйте Cloud Translation API и создайте ключ API.';
                break;
            case 'deepl':
                apiKeyInfo.innerHTML = 'Для DeepL API ключ можно получить в <a href="https://www.deepl.com/pro-api" target="_blank">DeepL Developer Dashboard</a>.<br>' +
                                      'Доступны бесплатный (Free) и платный (Pro) тарифы.';
                break;
            case 'microsoft':
                apiKeyInfo.innerHTML = 'Для Microsoft Translator API нужен ключ из <a href="https://portal.azure.com/" target="_blank">Azure Portal</a>.<br>' +
                                      'Создайте ресурс Translator в разделе Cognitive Services.';
                break;
        }
    }
    
    // Вызываем функцию при загрузке страницы
    updateApiKeyInfo();
    
    // Добавляем обработчик события изменения API
    translationApiSelector.addEventListener('change', updateApiKeyInfo);
    
    // File handling for standard translator
    const fileInput = document.getElementById('standard-file');
    const fileName = document.getElementById('standard-file-name');
    const translateBtn = document.getElementById('translate-btn');
    const apiKeyStandard = document.getElementById('api-key-standard');
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            if (e.target.files.length === 1) {
                fileName.textContent = e.target.files[0].name;
            } else {
                fileName.textContent = `Выбрано файлов: ${e.target.files.length}`;
            }
            updateStandardButtonState();
        } else {
            fileName.textContent = 'Файлы не выбраны';
            updateStandardButtonState();
        }
    });
    
    apiKeyStandard.addEventListener('input', updateStandardButtonState);
    
    function updateStandardButtonState() {
        translateBtn.disabled = !(
            fileInput.files.length > 0 && 
            apiKeyStandard.value.trim() !== ''
        );
    }
    
    // File handling for Gemini translator
    const geminiFileInput = document.getElementById('gemini-file');
    const geminiFileName = document.getElementById('gemini-file-name');
    const geminiTranslateBtn = document.getElementById('gemini-translate-btn');
    const apiKeyInput = document.getElementById('api-key');
    
    geminiFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            if (e.target.files.length === 1) {
                geminiFileName.textContent = e.target.files[0].name;
            } else {
                geminiFileName.textContent = `Выбрано файлов: ${e.target.files.length}`;
            }
            
            // Estimate word count for all files
            estimateWordCountForMultipleFiles(e.target.files);
            
            updateGeminiButtonState();
        } else {
            geminiFileName.textContent = 'Файлы не выбраны';
            document.getElementById('word-limit-counter').textContent = '0';
            updateGeminiButtonState();
        }
    });
    
    apiKeyInput.addEventListener('input', updateGeminiButtonState);
    
    // Button event listeners
    translateBtn.addEventListener('click', handleStandardTranslation);
    geminiTranslateBtn.addEventListener('click', handleGeminiTranslation);
    document.getElementById('download-btn').addEventListener('click', downloadTranslatedFile);
    
    function updateGeminiButtonState() {
        geminiTranslateBtn.disabled = !(
            geminiFileInput.files.length > 0 && 
            apiKeyInput.value.trim() !== ''
        );
    }
    
    function initializeLanguages() {
        const languages = [
            { code: 'en', name: 'Английский' },
            { code: 'ru', name: 'Русский' },
            { code: 'uk', name: 'Украинский' },
            { code: 'fr', name: 'Французский' },
            { code: 'de', name: 'Немецкий' },
            { code: 'es', name: 'Испанский' },
            { code: 'it', name: 'Итальянский' },
            { code: 'pt', name: 'Португальский' },
            { code: 'zh', name: 'Китайский' },
            { code: 'ja', name: 'Японский' },
            { code: 'ko', name: 'Корейский' }
        ];
        
        const sourceLangSelectors = ['source-lang', 'gemini-source-lang'];
        const targetLangSelectors = ['target-lang', 'gemini-target-lang'];
        
        sourceLangSelectors.forEach(selector => {
            const select = document.getElementById(selector);
            fillLanguageOptions(select, languages, 'en');
        });
        
        targetLangSelectors.forEach(selector => {
            const select = document.getElementById(selector);
            fillLanguageOptions(select, languages, 'ru');
        });
    }
    
    function fillLanguageOptions(select, languages, defaultLang) {
        select.innerHTML = '';
        languages.forEach(lang => {
            const option = document.createElement('option');
            option.value = lang.code;
            option.textContent = lang.name;
            select.appendChild(option);
        });
        select.value = defaultLang;
    }
    
    function switchTab(tabId) {
        // Скрываем все вкладки
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Убираем активный класс со всех кнопок
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Показываем выбранную вкладку
        document.getElementById(tabId).classList.add('active');
        
        // Делаем кнопку активной
        document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');
        
        // Очищаем результаты предыдущего перевода
        document.getElementById('result-container').classList.add('hidden');
        document.getElementById('download-container').classList.add('hidden');
        document.getElementById('progress-bar').style.width = '0%';
        document.getElementById('status-message').textContent = '';
        
        // Очищаем данные предыдущей загрузки, если они существуют
        if (window.downloadData && window.downloadData.url) {
            URL.revokeObjectURL(window.downloadData.url);
            window.downloadData = null;
        }
    }
});