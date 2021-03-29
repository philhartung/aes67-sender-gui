const { app, BrowserWindow, ipcMain } = require('electron');

const createWindow = function(){
	const win = new BrowserWindow({
		width: 400,
		height: 600,
		webPreferences: {
			nodeIntegration: true,
			devTools: true
		}
	})

	win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', function(){
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', function(){
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});