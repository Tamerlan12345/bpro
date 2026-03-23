const { fetchWithRetry } = require('../utils/resilientFetch');

describe('fetchWithRetry', () => {
    test('retries and succeeds on a later attempt', async () => {
        const fetchMock = jest
            .fn()
            .mockRejectedValueOnce(new Error('temporary error'))
            .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

        const response = await fetchWithRetry('https://example.com', {}, {
            fetchImpl: fetchMock,
            retries: 1,
            timeoutMs: 2000,
            retryDelayMs: 1
        });

        expect(response.ok).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test('throws after retries are exhausted', async () => {
        const fetchMock = jest.fn().mockRejectedValue(new Error('down'));

        await expect(fetchWithRetry('https://example.com', {}, {
            fetchImpl: fetchMock,
            retries: 2,
            timeoutMs: 2000,
            retryDelayMs: 1
        })).rejects.toThrow('down');

        expect(fetchMock).toHaveBeenCalledTimes(3);
    });
});
