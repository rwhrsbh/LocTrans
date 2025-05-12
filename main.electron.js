const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');

// Зберігаємо глобальне посилання на вікно, інакше вікно 
// автоматично закриється, коли об'єкт буде зібраний збирачем сміття
let mainWindow;

function createWindow() {
  // Визначаємо шлях до іконки в залежності від платформи
  let iconPath;
  if (process.platform === 'darwin') {
    iconPath = path.join(__dirname, 'app-icons/icons/mac/icon.icns');
  } else if (process.platform === 'win32') {
    iconPath = path.join(__dirname, 'app-icons/icons/win/icon.ico');
  } else {
    iconPath = path.join(__dirname, 'app-icons/icons/png/1024x1024.png');
  }

  // Перевіряємо чи є готові іконки, інакше використовуємо оригінальну
  try {
    require('fs').accessSync(iconPath, require('fs').constants.F_OK);
  } catch (err) {
    iconPath = path.join(__dirname, 'img/image.png');
  }

  // Створюємо вікно браузера
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: iconPath
  });

  // Завантажуємо index.html
  mainWindow.loadFile('index.html');

  // Відкриваємо DevTools при розробці
//   mainWindow.webContents.openDevTools();

  // Обробляємо закриття вікна
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// Цей метод буде викликано, коли Electron закінчить ініціалізацію
// і буде готовий створювати вікна браузера.
app.whenReady().then(createWindow);

// Виходимо, коли всі вікна закриті
app.on('window-all-closed', function () {
  // На macOS додатки і їх меню залишаються активними, поки користувач не вийде
  // явно за допомогою Cmd + Q
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  // На macOS зазвичай перестворюють вікно в додатку, коли
  // іконка док натиснута і немає інших відкритих вікон.
  if (mainWindow === null) createWindow();
}); 