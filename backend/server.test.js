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
        it('should return only pending chats for the specified department', async () => {
            const department1Id = 'd1b2c3a4-e5f6-7890-1234-567890abcdef';
            const department2Id = 'a0b1c2d3-e4f5-6789-0123-456789abcdef';

            const chats = [{
                id: 'c1b2c3a4-e5f6-7890-1234-567890abcdef',
                name: 'Chat 1',
                department_id: department1Id,
                chat_statuses: {
                    status: 'draft'
                }
            }, {
                id: 'c2b2c3a4-e5f6-7890-1234-567890abcdef',
                name: 'Chat 2',
                department_id: department2Id,
                chat_statuses: {
                    status: 'needs_revision'
                }
            }, ];

            // Mock the Supabase query
            when(mockSupabase.from)
                .calledWith('chats')
                .mockReturnValue({
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    in: jest.fn().mockResolvedValue({
                        data: [chats[0]],
                        error: null
                    })
                });

            const response = await request(app)
                .get('/api/admin/chats/pending')
                .query({
                    department_id: department1Id
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(1);
            expect(response.body[0].chat_id).toBe(chats[0].id);
        });

        it('should return a 400 error if department_id is not provided', async () => {
            const response = await request(app)
                .get('/api/admin/chats/pending');

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Department ID is required');
        });
    });
});
