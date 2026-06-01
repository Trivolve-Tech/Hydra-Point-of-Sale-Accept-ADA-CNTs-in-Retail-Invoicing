import { execFile } from "child_process";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const TEMPLATE_PATH =
  process.env.HYDRA_HEAD_COMPOSE_TEMPLATE ??
  "./infra/docker/compose.head.tmpl.yml";

const HEADS_OUTPUT_DIR =
  process.env.HYDRA_HEADS_COMPOSE_DIR ??
  "./infra/docker/heads";

export type ComposeRenderVars = {
  HEAD_ID: string;
  NETWORK: "preprod" | "mainnet";
  TESTNET_MAGIC_FLAG: string;
  MERCHANT_API_PORT: string;
  MERCHANT_PEER_PORT: string;
  CUSTOMER_API_PORT: string;
  CUSTOMER_PEER_PORT: string;
  HYDRA_SCRIPTS_TX_ID: string;
  CONTESTATION_PERIOD_SECONDS: string;
  MERCHANT_HYDRA_SK_PATH: string;
  MERCHANT_CARDANO_SK_PATH: string;
  MERCHANT_HYDRA_VK_PATH: string;
  MERCHANT_CARDANO_VK_PATH: string;
  CUSTOMER_HYDRA_SK_PATH: string;
  CUSTOMER_CARDANO_SK_PATH: string;
  CUSTOMER_HYDRA_VK_PATH: string;
  CUSTOMER_CARDANO_VK_PATH: string;
  BASE_NETWORK: string;
};

export async function renderAndWriteCompose(vars: ComposeRenderVars): Promise<string> {
  const template = await readFile(TEMPLATE_PATH, "utf8");
  const rendered = substitute(template, vars);
  const outPath = join(HEADS_OUTPUT_DIR, `${vars.HEAD_ID}.yml`);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, rendered, "utf8");
  return outPath;
}

export async function composeUp(composeFile: string): Promise<void> {
  await execFileAsync("docker", ["compose", "-f", composeFile, "up", "-d"]);
}

export async function composeDown(composeFile: string): Promise<void> {
  await execFileAsync("docker", ["compose", "-f", composeFile, "down"]);
}

function substitute(template: string, vars: Record<string, string>): string {
  return template.replace(/\$\{(\w+)\}/g, (_, name: string) => {
    if (!(name in vars)) {
      throw new Error(`compose template missing var: ${name}`);
    }
    return vars[name]!;
  });
}
