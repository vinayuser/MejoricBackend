const axios = require('axios');
const fs = require('fs');

const enablexConfig = {
    APP_ID: process.env.ENABLE_X_APP_ID,
    APP_KEY: process.env.ENABLE_X_APP_KEY,
    BASE_URL: 'https://api.enablex.io/video/v2/',
};

const audioEnablexConfig = {
    APP_ID: process.env.ENABLE_X_AUDIO_APP_ID,
    APP_KEY: process.env.ENABLE_X_AUDIO_APP_KEY,
    BASE_URL: 'https://api.enablex.io/video/v2/',
}

const audioEnablexAxios = axios.create({
    baseURL: audioEnablexConfig.BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(
            `${audioEnablexConfig.APP_ID}:${audioEnablexConfig.APP_KEY}`
        ).toString('base64')}`,
    },
});

// Axios instance with interceptors if needed
const enablexAxios = axios.create({
    baseURL: enablexConfig.BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(
            `${enablexConfig.APP_ID}:${enablexConfig.APP_KEY}`
        ).toString('base64')}`,
    },
});

module.exports = { enablexConfig, enablexAxios, audioEnablexAxios, audioEnablexConfig };
