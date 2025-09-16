const request = require('supertest');
const express = require('express');
const { when } = require('jest-when');

// Mock the supabase client
const mockSelect = jest.fn();
const mockEq = jest.fn(() => ({
    in: mockIn
}));
const mockIn = jest.fn(() => ({
    select: mockSelect
}));

const mockSupabase = {
    from: jest.fn(() => ({
        select: mockSelect,
        eq: mockEq
    }))
};

jest.mock('@supabase/supabase-js', () => ({
    createClient: () => mockSupabase
}));

// Import the app after mocking
const { app, server } = require('./server');

describe('Admin API', () => {
    afterAll((done) => {
        server.close(done);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/admin/chats/pending', () => {
        it('should return all pending chats (draft or needs_revision) from all departments', async () => {
            const mockChats = [
                {
                    id: 'c1',
                    name: 'Chat 1',
                    chat_statuses: { status: 'draft' },
                    departments: { name: 'Sales' }
                },
                {
                    id: 'c2',
                    name: 'Chat 2',
                    chat_statuses: { status: 'needs_revision' },
                    departments: { name: 'Support' }
                },
                // This chat should be filtered out by the '.in' clause
                {
                    id: 'c3',
                    name: 'Chat 3',
                    chat_statuses: { status: 'completed' },
                    departments: { name: 'Sales' }
                }
            ];

            // Mock the Supabase query to return the first two chats
            when(mockSupabase.from)
                .calledWith('chats')
                .mockReturnValue({
                    select: jest.fn().mockReturnThis(),
                    in: jest.fn().mockResolvedValue({
                        data: [mockChats[0], mockChats[1]],
                        error: null
                    })
                });

            const response = await request(app).get('/api/admin/chats/pending');

            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(2);

            // Check that the data is transformed correctly
            expect(response.body[0].chat_id).toBe('c1');
            expect(response.body[0].status).toBe('draft');
            expect(response.body[0].chats.name).toBe('Chat 1 (Sales)');

            expect(response.body[1].chat_id).toBe('c2');
            expect(response.body[1].status).toBe('needs_revision');
            expect(response.body[1].chats.name).toBe('Chat 2 (Support)');

            // Verify that the query doesn't use .eq for department_id anymore
            expect(mockEq).not.toHaveBeenCalled();
        });
    });
});
