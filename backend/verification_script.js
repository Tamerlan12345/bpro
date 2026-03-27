const fetch = require('node-fetch');

async function verify() {
    const url = 'http://localhost:8080/api/csrf-token';
    console.log(`Checking ${url}...`);
    try {
        const response = await fetch(url);
        console.log(`Status: ${response.status}`);
        console.log(`CORS Origin: ${response.headers.get('access-control-allow-origin')}`);
        console.log(`CORS Credentials: ${response.headers.get('access-control-allow-credentials')}`);
        
        if (response.status === 200) {
            console.log('SUCCESS: Server is up and CORS headers are present.');
        } else {
            console.log('WARNING: Server responded with non-200 status.');
        }
    } catch (error) {
        console.error('ERROR: Could not connect to the server. Is it running?');
    }
}

verify();
