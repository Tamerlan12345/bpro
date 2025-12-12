const { z } = require('zod');
const { departmentSchema, chatSchema } = require('../server');

describe('Zod Validation Schemas', () => {
    test('departmentSchema validation', () => {
        const validData = {
            name: 'HR',
            password: 'secret',
            user_id: '123'
        };
        expect(() => departmentSchema.parse(validData)).not.toThrow();

        const invalidData = {
            name: '',
            password: 'secret',
            user_id: 'invalid-numeric-string'
        };
        expect(() => departmentSchema.parse(invalidData)).toThrow();
    });

    test('chatSchema validation', () => {
        const validData = {
            department_id: '456',
            name: 'Chat 1',
            password: 'secure'
        };
        expect(() => chatSchema.parse(validData)).not.toThrow();

         const invalidData = {
            department_id: 'invalid-numeric-string',
            name: '',
            password: ''
        };
        expect(() => chatSchema.parse(invalidData)).toThrow();
    });
});
