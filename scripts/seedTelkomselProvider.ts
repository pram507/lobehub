import * as dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';

// Load environment variables in priority order
const env = process.env.NODE_ENV || 'development';
dotenvExpand.expand(dotenv.config()); // Load .env
dotenvExpand.expand(dotenv.config({ override: true, path: `.env.${env}` })); // Load .env.[env]
dotenvExpand.expand(dotenv.config({ override: true, path: `.env.${env}.local` })); // Load .env.[env].local

const runSeeding = async () => {
  console.log('🌱 Starting Telkomsel AI Custom Provider Seeding...');

  // Lazy-load database and schemas to ensure environment variables are loaded first
  const { serverDB } = await import('../packages/database/src/server');
  const { users, aiProviders, aiModels } = await import('../packages/database/src/schemas');
  const { UserModel } = await import('../packages/database/src/models/user');
  const { KeyVaultsGateKeeper } = await import('../src/server/modules/KeyVaultsEncrypt');

  const userId = process.env.MOCK_DEV_USER_ID || 'DEV_USER';

  // Extract custom provider/model config with defaults
  const providerId = process.env.DEFAULT_TSEL_PROVIDER_ID || 'telkomsel-ai';
  const providerName = process.env.DEFAULT_TSEL_PROVIDER_NAME || 'Telkomsel AI';
  const modelId = process.env.DEFAULT_TSEL_MODEL_ID || 'model-GPU_1-2_new';
  const modelName = process.env.DEFAULT_TSEL_MODEL_NAME || 'Model GPU 1-2 New';
  const apiKey = process.env.DEFAULT_TSEL_API_KEY || 'sk-lTvWrv2HJJiY9PZDfTNQPA';
  const baseURL = process.env.DEFAULT_TSEL_PROXY_URL || 'https://genai.aihubnusantara.id/v1';

  // 1. Make sure the user exists to prevent foreign key violations
  console.log(`👤 Ensuring user "${userId}" exists in the database...`);
  await UserModel.makeSureUserExist(serverDB, userId);
  console.log(`✓ User "${userId}" is ready.`);

  // 2. Prepare encrypted key vaults for the custom provider
  console.log(`🔐 Encrypting api credentials for the "${providerName}" provider...`);
  console.log(`   - Base URL: ${baseURL}`);
  console.log(`   - API Key: ${apiKey.slice(0, 7)}...`);

  const gateKeeper = await KeyVaultsGateKeeper.initWithEnvKey();
  const keyVaults = await gateKeeper.encrypt(
    JSON.stringify({
      apiKey,
      baseURL,
    }),
  );

  // 3. Upsert the Custom AI provider row
  console.log(`🔌 Upserting custom provider "${providerId}" in "ai_providers"...`);

  const providerData = {
    id: providerId,
    name: providerName,
    userId,
    enabled: true,
    source: 'custom' as const,
    checkModel: modelId,
    keyVaults,
    settings: {
      authType: 'apiKey' as const,
      sdkType: 'openai' as const,
      showApiKey: true,
      showAddNewModel: true,
      showModelFetcher: true,
    },
  };

  await serverDB
    .insert(aiProviders)
    .values(providerData)
    .onConflictDoUpdate({
      target: [aiProviders.id, aiProviders.userId],
      set: {
        name: providerData.name,
        enabled: providerData.enabled,
        checkModel: providerData.checkModel,
        keyVaults: providerData.keyVaults,
        settings: providerData.settings,
        updatedAt: new Date(),
      },
    });

  console.log(`✓ Provider "${providerId}" upserted successfully.`);

  // 4. Upsert the custom model under this provider
  console.log(
    `🤖 Upserting custom model "${modelId}" under provider "${providerId}" in "ai_models"...`,
  );

  const modelData = {
    id: modelId,
    displayName: modelName,
    enabled: true,
    providerId,
    userId,
    source: 'custom' as const,
    type: 'chat',
    abilities: {
      vision: true,
      functionCall: true,
    },
  };

  await serverDB
    .insert(aiModels)
    .values(modelData)
    .onConflictDoUpdate({
      target: [aiModels.id, aiModels.providerId, aiModels.userId],
      set: {
        displayName: modelData.displayName,
        enabled: modelData.enabled,
        source: modelData.source,
        type: modelData.type,
        abilities: modelData.abilities,
        updatedAt: new Date(),
      },
    });

  console.log(`✓ Custom model "${modelId}" upserted successfully.`);
  console.log('🎉 Seeding completed successfully!');
  process.exit(0);
};

runSeeding().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});
