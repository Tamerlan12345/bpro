async function resolveMigrationRunner(loadMigrationModule = () => import('node-pg-migrate')) {
    const migrationModule = await loadMigrationModule();

    if (typeof migrationModule.runner === 'function') {
        return migrationModule.runner;
    }

    if (typeof migrationModule.default === 'function') {
        return migrationModule.default;
    }

    throw new TypeError('node-pg-migrate runner export is not a function');
}

module.exports = {
    resolveMigrationRunner,
};
