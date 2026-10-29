const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: '玄机阁 · 八字每日运势',
    backgroundColor: '#1a1a2e',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    },
    icon: path.join(__dirname, 'icon.ico')
  });

  win.loadFile('index.html');

  // 外部链接用系统浏览器打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    if(/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

ipcMain.handle("algorithm:run", (event,q)=>{
  const url=event.senderFrame?.url||""; if(!url.startsWith("file:")||!url.endsWith("index.html"))throw Error("仅本应用界面可调用算法");
  return require("./algorithm-bridge.js").run(q,app.isPackaged?path.join(process.resourcesPath,"engine"):path.join(__dirname,"engine"));
});
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
