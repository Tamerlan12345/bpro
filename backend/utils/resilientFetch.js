const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetchImpl(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeout);
    }
}

async function fetchWithRetry(url, options = {}, config = {}) {
    const {
        fetchImpl = fetch,
        retries = 2,
        timeoutMs = 15000,
        retryDelayMs = 300
    } = config;

    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            return await fetchWithTimeout(fetchImpl, url, options, timeoutMs);
        } catch (error) {
            lastError = error;
            if (attempt === retries) {
                throw error;
            }
            await sleep(retryDelayMs * (attempt + 1));
        }
    }

    throw lastError;
}

module.exports = { fetchWithRetry };
