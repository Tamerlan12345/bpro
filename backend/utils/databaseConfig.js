const { parse } = require('pg-connection-string');

function isTruthyFlag(value) {
    return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function isFalsyFlag(value) {
    return ['0', 'false', 'no', 'off'].includes(String(value || '').toLowerCase());
}

function resolveSslConfig(nodeEnv, env = {}) {
    if (isFalsyFlag(env.databaseSsl) || isFalsyFlag(env.pgssl)) {
        return false;
    }

    const shouldUseSsl = nodeEnv === 'production' || isTruthyFlag(env.databaseSsl) || isTruthyFlag(env.pgssl);
    if (!shouldUseSsl) {
        return false;
    }

    if (isTruthyFlag(env.databaseSslRejectUnauthorized) || isTruthyFlag(env.pgsslRejectUnauthorized)) {
        return { rejectUnauthorized: true };
    }

    return { rejectUnauthorized: false };
}

function createDatabaseConfig(databaseUrl, nodeEnv = process.env.NODE_ENV, env = {}) {
    const config = parse(databaseUrl);
    return {
        ...config,
        ssl: resolveSslConfig(nodeEnv, env)
    };
}

module.exports = {
    createDatabaseConfig
};
