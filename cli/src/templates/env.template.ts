export function buildEnvTemplate(projectName: string, workspace: string): string {
  return `KANBAN_WORKSPACE=${workspace}
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
KANBAN_PROJECT=${projectName}
`;
}
