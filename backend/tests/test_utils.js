const getCsrfToken = async (agent) => {
    const res = await agent.get('/api/csrf-token');
    if (res.status !== 200) {
        throw new Error(`Failed to fetch CSRF token: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return res.body.csrfToken;
};

module.exports = { getCsrfToken };
