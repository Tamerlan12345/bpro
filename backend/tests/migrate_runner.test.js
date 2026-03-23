describe('resolveMigrationRunner', () => {
    test('returns node-pg-migrate named runner export', async () => {
        const { resolveMigrationRunner } = require('../scripts/migrateRunner');
        const runnerFn = jest.fn();

        const runner = await resolveMigrationRunner(async () => ({
            runner: runnerFn,
        }));

        expect(runner).toBe(runnerFn);
    });
});
