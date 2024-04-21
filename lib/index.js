const core = require('@actions/core');
const fetch = require('node-fetch');

const RENDER_BASE_URL = 'https://api.render.com';
const RENDER_API_KEY = core.getInput('render-api-key');
const DEFAULT_HEADERS = {
    accept: 'application/json', 'content-type': 'application/json', 'authorization': `Bearer ${RENDER_API_KEY}`
};

async function makeRequest(method, url, body) {
    const requestInit = { method, headers: DEFAULT_HEADERS };
    if (body) {
        requestInit.body = JSON.stringify(body);
    }
    const response = await fetch(`${RENDER_BASE_URL}/${url}`, requestInit);
    if (!response.ok) {
        throw new Error(`Failed to make request: ${response.status} - ${await response.text()}`);
    }
    return { status: response.status, data: await response.json() };
}

async function triggerWebhookDeploy(deployHook, imageUrl) {
    const params = new URLSearchParams()
    params.append('imgURL', imageUrl);
    const url = `${deployHook}&${params.toString()}`;
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok || response.status !== 200) {
        throw new Error(`Failed to trigger deploy: ${response.status} - ${await response.text()}`);
    }
    return await response.json();
}

async function retrieveDeploy(serviceId, deployId) {
    const { status, data } = await makeRequest('GET', `v1/services/${serviceId}/deploys/${deployId}`);
    if (status !== 200) {
        throw new Error(`Failed to retrieve deploy: ${status} - ${data['message']}`);
    }
    return data;
}

function extractServiceId(deployHook) {
    const match = deployHook.match(/\/deploy\/(.*?)\?key=/);
    if (!match || match.length < 1) {
        throw new Error('Failed to extract service ID from deploy hook');
    }
    return match[1];
}

function deployTimer(maxWaitTime) {
    const timer = setTimeout(() => {
        clearTimeout(timer);
        throw new Error(`Max wait time of ${maxWaitTime} seconds exceeded!`);
    }, maxWaitTime * 1000);
}

function validateInputs() {
    const deployHook = core.getInput('deploy-hook');
    const serviceId = extractServiceId(deployHook);
    const dockerRepoPrefix = core.getInput('docker-repo-prefix');
    const waitForDeployment = core.getBooleanInput('wait-for-deployment');
    const maxWaitTime = Number(core.getInput('max-wait-time'));

    let imageUrl = core.getInput('image-url');
    if (!imageUrl.startsWith(dockerRepoPrefix)) {
        imageUrl = `${dockerRepoPrefix}/${imageUrl}`;
    }

    if (!deployHook) {
        throw new Error('Deploy hook is required');
    }
    if (!imageUrl) {
        throw new Error('Image URL is required');
    }
    if (waitForDeployment && (!RENDER_API_KEY || !serviceId)) {
        throw new Error('Render API key is required if wait-for-deployment is set to true');
    }
    if (maxWaitTime < 60) {
        throw new Error('Max wait time must be at least 60 seconds');
    }

    return {
        deployHook,
        serviceId,
        imageUrl,
        waitForDeployment,
        maxWaitTime,
    }
}

async function run() {
    core.info('Validating inputs...');
    const {
        deployHook,
        serviceId,
        imageUrl,
        waitForDeployment,
        maxWaitTime,
    } = validateInputs();

    const TIME_SECONDS_BETWEEN_EACH_DEPLOYMENT_CHECK = 10;

    core.info(`Triggering deploy...`);
    const { deploy } = await triggerWebhookDeploy(deployHook, imageUrl);
    core.info(`Successfully triggered deployment!`);

    if (waitForDeployment) {
        core.info(`Waiting for deployment to complete...`);
        deployTimer(maxWaitTime);
        while (true) {
            const { status } = await retrieveDeploy(serviceId, deploy['id']);
            if (status === 'live') {
                core.info('Deployment is live!')
                break;
            }
            core.info(`Current deploy status: ${status}`)
            await new Promise(resolve => setTimeout(resolve, TIME_SECONDS_BETWEEN_EACH_DEPLOYMENT_CHECK * 1000));
        }
    }
}

(async () => {
    try {
        await run();
    } catch (error) {
        core.setFailed(error.message);
    }
})();
