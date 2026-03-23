const { buildStructuredLayout } = require('../public/modules/map-layout-core.js');

describe('structured admin map layout', () => {
    test('keeps every department child on one vertical line and places chats after processes', () => {
        const positions = buildStructuredLayout({
            rootId: 'root_company',
            departments: [
                { id: 'dept-sales', name: 'Продажи' },
                { id: 'dept-hr', name: 'HR' }
            ],
            processes: [
                { id: 'proc-onboarding', name: 'Onboarding', departmentId: 'dept-hr' },
                { id: 'proc-hiring', name: 'Hiring', departmentId: 'dept-hr' }
            ],
            chats: [
                { id: 'chat-candidates', name: 'Candidates', departmentId: 'dept-hr' },
                { id: 'chat-offers', name: 'Offers', departmentId: 'dept-hr' }
            ]
        });

        const byId = Object.fromEntries(positions.map((item) => [item.id, item]));

        expect(byId['dept-hr'].x).toBe(byId['proc-hiring'].x);
        expect(byId['proc-hiring'].x).toBe(byId['proc-onboarding'].x);
        expect(byId['proc-onboarding'].x).toBe(byId['chat-candidates'].x);
        expect(byId['chat-candidates'].x).toBe(byId['chat-offers'].x);

        expect(byId['proc-hiring'].y).toBeLessThan(byId['proc-onboarding'].y);
        expect(byId['proc-onboarding'].y).toBeLessThan(byId['chat-candidates'].y);
        expect(byId['chat-candidates'].y).toBeLessThan(byId['chat-offers'].y);
    });
});
