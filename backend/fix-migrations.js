// backend/fix-migrations.js
const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, 'migrations');

const renames = {
    '1774000000001_add_positions_to_processes.js': '2000000000002_add_positions_to_processes.js',
    '1774000000002_add_department_positions.js': '2000000000003_add_department_positions.js',
    '1774000000003_add_chats_positions.js': '2000000000004_add_chats_positions.js'
};

Object.keys(renames).forEach(oldName => {
    const oldPath = path.join(migrationsDir, oldName);
    const newPath = path.join(migrationsDir, renames[oldName]);
    if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
        console.log(`✅ Файл переименован: ${oldName} -> ${renames[oldName]}`);
    }
});
console.log('Готово! Теперь перезапусти Docker-контейнеры.');
