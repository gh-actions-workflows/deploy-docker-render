const core = require('@actions/core');
const fetch = require('node-fetch');

const RENDER_BASE_URL = 'https://api.render.com';
const RENDER_API_KEY = core.getInput('render-api-key');
const DEFAULT_HEADERS = {
    accept: 'application/json', 'content-type': 'application/json', 'authorization': `Bearer ${RENDER_API_KEY}`
};

async function makeRequest(method, url, body = {}) {
    const response = await fetch(`${RENDER_BASE_URL}/${url}`, { method, headers: DEFAULT_HEADERS, body: JSON.stringify(body) });
    if (!response.ok) {
        throw new Error(`Failed to make request: ${response.status} - ${await response.text()}`);
    }
    return { status: response.status, data: await response.json() };
}


async function triggerDeploy(serviceId, imageUrl, clearCache) {
    const { status, data } = await makeRequest('POST', `v1/services/${serviceId}/deploys`, { imageUrl, clearCache });
    if (status !== 201) {
        throw new Error(`Failed to trigger deploy: ${status} - ${data['message']}`);
    }
    return data;
}

async function retrieveDeploy(serviceId, deployId) {
    const { status, data } = await makeRequest('GET', `v1/services/${serviceId}/deploys/${deployId}`);
    if (status !== 200) {
        throw new Error(`Failed to retrieve deploy: ${status} - ${data['message']}`);
    }
    return data;
}

async function run() {
    const TIME_SECONDS_BETWEEN_EACH_DEPLOYMENT_CHECK = 10;
    const serviceId = core.getInput('service-id');
    const dockerRepoPrefix = core.getInput('docker-repo-prefix');
    const imageUrl = `${dockerRepoPrefix}/${core.getInput('image-url')}`;
    const waitForDeployment = core.getBooleanInput('wait-for-deployment');
    const maxWaitTime = Number(core.getInput('max-wait-time'));
    const clearCache = core.getBooleanInput('clear-cache');

    core.info(`Triggering deploy`);
    const data = await triggerDeploy(serviceId, imageUrl, clearCache ? 'clear' : 'do_not_clear');

    const initialTime = Date.now();

    core.info(`Waiting for deployment to complete...`);
    if (waitForDeployment) {
        while (true) {
            const { status } = await retrieveDeploy(serviceId, data['id']);
            if (status === 'live') {
                core.info('Deployment complete!')
                break;
            }
            if (Date.now() - initialTime > maxWaitTime) {
                throw new Error(`Max wait time of ${maxWaitTime} seconds exceeded`);
            }
            console.log(`Current deploy status: ${status}`)
            await new Promise(resolve => setTimeout(resolve, TIME_SECONDS_BETWEEN_EACH_DEPLOYMENT_CHECK * 1000));
        }
    }
    core.setFailed(error.message);
}

(async () => {
    try {
        await run();
    } catch (error) {
        core.setFailed(error.message);
    }
})();
