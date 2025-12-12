const { z } = require('zod');
const { departmentSchema, chatSchema } = require('../server');

describe('Zod Validation Schemas', () => {
    test('departmentSchema validation', () => {
        const validData = {
            name: 'HR',
            password: 'secret',
            user_id: '123e4567-e89b-12d3-a456-426614174000'
        };
        expect(() => departmentSchema.parse(validData)).not.toThrow();

        const invalidData = {
            name: '',
            password: 'secret',
            user_id: 'invalid-uuid'
        };
        expect(() => departmentSchema.parse(invalidData)).toThrow();
    });

    test('chatSchema validation', () => {
        const validData = {
            department_id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Chat 1',
            password: 'secure'
        };
        expect(() => chatSchema.parse(validData)).not.toThrow();

         const invalidData = {
            department_id: 'invalid-uuid',
            name: '',
            password: ''
        };
        expect(() => chatSchema.parse(invalidData)).toThrow();
    });
});
