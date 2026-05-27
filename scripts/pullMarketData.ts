import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';

import { MarketSDK } from '@lobehub/market-sdk';

const MARKET_BASE_URL = process.env.MARKET_BASE_URL;

const AGENTS_INDEX_URL = MARKET_BASE_URL
  ? `${MARKET_BASE_URL}/api/v1/agents/index.json`
  : 'https://chat-agents.lobehub.com/index.json';
const PLUGINS_INDEX_URL = MARKET_BASE_URL
  ? `${MARKET_BASE_URL}/api/v1/plugins/index.json`
  : 'https://chat-plugins.lobehub.com/index.json';

const SKILL_CATEGORIES_URL = MARKET_BASE_URL
  ? `${MARKET_BASE_URL}/api/v1/skills/categories`
  : 'https://market.lobehub.com/api/v1/skills/categories';
const SKILL_LIST_URL = MARKET_BASE_URL
  ? `${MARKET_BASE_URL}/api/v1/skills`
  : 'https://market.lobehub.com/api/v1/skills';

const DATA_DIR = path.join(process.cwd(), 'data', 'market');

// Note: Ensure that if you are hitting the official market.lobehub.com for skills,
// you might need authorization headers depending on the API's requirements.
const fetchOptions: RequestInit = {
  headers: {},
};

async function initializeToken() {
  const token = process.env.MARKET_ACCESS_TOKEN;
  if (token) {
    fetchOptions.headers = { Authorization: `Bearer ${token}` };
    return;
  }

  const clientId = process.env.MARKET_CLIENT_ID;
  const clientSecret = process.env.MARKET_CLIENT_SECRET;

  if (clientId && clientSecret) {
    console.log('Fetching M2M token using client credentials...');
    const market = new MarketSDK({
      clientId,
      clientSecret,
      baseURL: MARKET_BASE_URL || 'https://market.lobehub.com',
    });

    try {
      const res = await market.fetchM2MToken();
      if (res && res.accessToken) {
        console.log('Successfully fetched M2M token.');
        fetchOptions.headers = { Authorization: `Bearer ${res.accessToken}` };
      }
    } catch (err) {
      console.error('Failed to fetch M2M token:', err);
    }
  }
}

async function fetchAndSave(url: string, filename: string) {
  try {
    console.log(`Fetching ${url}...`);
    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} from ${url}`);
    }
    const data = await response.json();

    const filePath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Saved ${filename} to ${DATA_DIR}`);
    return data;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return null;
  }
}

async function fetchAndSaveText(url: string, filename: string) {
  try {
    console.log(`Fetching ${url}...`);
    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} from ${url}`);
    }
    const text = await response.text();

    const filePath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filePath, text, 'utf-8');
    console.log(`Saved ${filename} to ${DATA_DIR}`);
    return text;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return null;
  }
}

async function fetchSkillDetail(identifier: string) {
  const url = MARKET_BASE_URL
    ? `${MARKET_BASE_URL}/api/v1/skills/${encodeURIComponent(identifier)}`
    : `https://market.lobehub.com/api/v1/skills/${encodeURIComponent(identifier)}`;

  await fetchAndSave(url, `skills/${identifier}.json`);
}

async function fetchAgentDetail(identifier: string) {
  const url = MARKET_BASE_URL
    ? `${MARKET_BASE_URL}/api/v1/agents/detail/${encodeURIComponent(identifier)}`
    : `https://market.lobehub.com/api/v1/agents/detail/${encodeURIComponent(identifier)}`;

  await fetchAndSave(url, `agents/${identifier}.json`);
}

async function fetchPluginDetail(identifier: string) {
  const url = MARKET_BASE_URL
    ? `${MARKET_BASE_URL}/api/v1/plugins/${encodeURIComponent(identifier)}`
    : `https://market.lobehub.com/api/v1/plugins/${encodeURIComponent(identifier)}`;

  await fetchAndSave(url, `plugins/${identifier}.json`);
}

async function fetchPluginManifest(identifier: string) {
  const url = MARKET_BASE_URL
    ? `${MARKET_BASE_URL}/api/v1/plugins/${encodeURIComponent(identifier)}/manifest`
    : `https://market.lobehub.com/api/v1/plugins/${encodeURIComponent(identifier)}/manifest`;

  await fetchAndSave(url, `plugins/${identifier}-manifest.json`);
}

async function fetchProviderReadmes() {
  console.log('Fetching latest provider readmes from GitHub...');
  const providersDir = path.join(process.cwd(), 'docs', 'usage', 'providers');
  if (!fs.existsSync(providersDir)) {
    console.log('No local docs/usage/providers folder found. Skipping provider readmes.');
    return;
  }

  const files = fs.readdirSync(providersDir).filter((f) => f.endsWith('.mdx'));
  for (const file of files) {
    const url = `https://raw.githubusercontent.com/lobehub/lobe-chat/refs/heads/main/docs/usage/providers/${file}`;
    await fetchAndSaveText(url, `providers/readmes/${file}`);
  }
}

async function main() {
  await initializeToken();

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(path.join(DATA_DIR, 'skills'))) {
    fs.mkdirSync(path.join(DATA_DIR, 'skills'), { recursive: true });
  }
  if (!fs.existsSync(path.join(DATA_DIR, 'agents'))) {
    fs.mkdirSync(path.join(DATA_DIR, 'agents'), { recursive: true });
  }
  if (!fs.existsSync(path.join(DATA_DIR, 'plugins'))) {
    fs.mkdirSync(path.join(DATA_DIR, 'plugins'), { recursive: true });
  }
  if (!fs.existsSync(path.join(DATA_DIR, 'providers', 'readmes'))) {
    fs.mkdirSync(path.join(DATA_DIR, 'providers', 'readmes'), { recursive: true });
  }

  // Legacy static index
  await fetchAndSave(AGENTS_INDEX_URL, 'agents.json');
  await fetchAndSave(PLUGINS_INDEX_URL, 'plugins.json');

  // Dynamic agents
  const AGENTS_LIST_URL = MARKET_BASE_URL
    ? `${MARKET_BASE_URL}/api/v1/agents`
    : 'https://market.lobehub.com/api/v1/agents';
  const agentList = await fetchAndSave(AGENTS_LIST_URL, 'agents-list.json');

  if (agentList && Array.isArray(agentList.items)) {
    console.log(`Fetching details for ${agentList.items.length} agents...`);
    for (const agent of agentList.items) {
      if (agent.identifier) {
        await fetchAgentDetail(agent.identifier);
      }
    }
  }

  // Plugins (MCPs)
  const PLUGIN_CATEGORIES_URL = MARKET_BASE_URL
    ? `${MARKET_BASE_URL}/api/v1/plugins/categories`
    : 'https://market.lobehub.com/api/v1/plugins/categories';
  await fetchAndSave(PLUGIN_CATEGORIES_URL, 'plugin-categories.json');

  const PLUGINS_LIST_URL = MARKET_BASE_URL
    ? `${MARKET_BASE_URL}/api/v1/plugins`
    : 'https://market.lobehub.com/api/v1/plugins';
  const pluginList = await fetchAndSave(PLUGINS_LIST_URL, 'plugins-list.json');

  if (pluginList && Array.isArray(pluginList.items)) {
    console.log(`Fetching details for ${pluginList.items.length} plugins (MCPs)...`);
    for (const plugin of pluginList.items) {
      if (plugin.identifier) {
        await fetchPluginDetail(plugin.identifier);
        await fetchPluginManifest(plugin.identifier);
      }
    }
  }

  // Skills
  await fetchAndSave(SKILL_CATEGORIES_URL, 'skill-categories.json');
  const skillList = await fetchAndSave(SKILL_LIST_URL, 'skills.json');

  if (skillList && Array.isArray(skillList.items)) {
    console.log(`Fetching details for ${skillList.items.length} skills...`);
    for (const skill of skillList.items) {
      if (skill.identifier) {
        await fetchSkillDetail(skill.identifier);
      }
    }
  }

  // Provider Readmes
  await fetchProviderReadmes();

  // Providers List
  console.log('Generating providers.json from model-bank...');
  try {
    const { LOBE_DEFAULT_MODEL_LIST } = await import('model-bank');
    const { DEFAULT_MODEL_PROVIDER_LIST } = await import('model-bank/modelProviders');

    const providers = DEFAULT_MODEL_PROVIDER_LIST.map((item: any) => {
      const models = LOBE_DEFAULT_MODEL_LIST.filter((m: any) => m.providerId === item.id).map(
        (m: any) => m.id,
      );
      return {
        ...item,
        identifier: item.id,
        modelCount: [...new Set(models)].length,
        models: [...new Set(models)],
      };
    });

    fs.writeFileSync(
      path.join(DATA_DIR, 'providers.json'),
      JSON.stringify(providers, null, 2),
      'utf-8',
    );
    console.log('Saved providers.json to ' + DATA_DIR);
  } catch (error) {
    console.error('Failed to generate providers.json', error);
  }
}

main().catch(console.error);
