import path from 'path';
import os from 'os';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.kanban') });
dotenv.config(); // fallback a .env

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  workspace: process.env.KANBAN_WORKSPACE
    ? path.resolve(process.env.KANBAN_WORKSPACE.replace('~', os.homedir()))
    : path.join(os.homedir(), '.kanban'),
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  bedrock: {
    modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    mockMode: process.env.BEDROCK_MOCK === 'true',
  },
  currentProject: process.env.KANBAN_PROJECT || '',
} as const;
