// backend/fix-migrations.js
const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, 'migrations');

// Проблемные префиксы, которые мы ищем в именах файлов
const badTimestamps = {
    '20260320123000': '1774000000001',
    '20260321172138': '1774000000002',
    '20260321181500': '1774000000003'
};

fs.readdir(migrationsDir, (err, files) => {
    if (err) {
        console.error('Ошибка чтения папки migrations:', err);
        return;
    }

    files.forEach(file => {
        for (const [bad, good] of Object.entries(badTimestamps)) {
            if (file.startsWith(bad)) {
                const oldPath = path.join(migrationsDir, file);
                const newFileName = file.replace(bad, good);
                const newPath = path.join(migrationsDir, newFileName);
                
                fs.renameSync(oldPath, newPath);
                console.log(`✅ Файл переименован: ${file} -> ${newFileName}`);
            }
        }
    });
    
    console.log('Готово! Теперь перезапусти Docker-контейнеры.');
});
