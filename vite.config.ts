import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { readExecutionProfile } from "./scripts/execution-profile.mjs";
import { resolveCloudflarePreviewBindings } from "./scripts/cloudflare-preview-config.mjs";
import { resolveCloudflareRemoteTestConfig } from "./scripts/cloudflare-remote-test-config.mjs";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;
const localPersistPath = process.env.CVK_LOCAL_PERSIST_PATH;

// Workers Builds deploys to our Cloudflare account; Sites and local previews
// retain their existing placeholder bindings.
const cloudflareBuild = process.env.WORKERS_CI === "1";
// Worker Previews must never inherit the production D1/R2 targets above. A
// non-main Workers Build therefore requires explicit isolated resource IDs.
const cloudflarePreviewBindings = resolveCloudflarePreviewBindings(process.env);
// Optional local integration mode: only the fixed Phase-C test D1/R2 may be
// remote. This helper refuses Cloudflare Builds, CI, and production mode.
const cloudflareRemoteTestConfig = resolveCloudflareRemoteTestConfig(process.env);

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const managedLinux = readExecutionProfile() === "managed-linux";

const localBindingConfig = {
  ...(cloudflareRemoteTestConfig ?? {}),
  main: "vinext/server/fetch-handler",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: cloudflareRemoteTestConfig?.d1_databases ?? (d1
    ? [
        {
          binding: d1,
          database_name: cloudflareBuild ? "chronik-von-kleve-db" : "site-creator-d1",
          database_id: cloudflareBuild
            ? "a4bc79e6-3f33-4b03-b240-9c341bd1d4d7"
            : SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : []),
  r2_buckets: cloudflareRemoteTestConfig?.r2_buckets ?? (r2
    ? [
        {
          binding: r2,
          bucket_name: cloudflareBuild ? "chronik-von-kleve-r2" : "site-creator-r2",
        },
      ]
    : []),
  ...(cloudflareBuild ? { previews: cloudflarePreviewBindings } : {}),
};

export default defineConfig(async ({ command }) => {
  if (cloudflareRemoteTestConfig && command !== "serve") {
    throw new Error("Remote Cloudflare test bindings are allowed only for a local Vite dev server.");
  }

  // Use Miniflare's local Request.cf placeholder unless fetching is requested.
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
  process.env.WRANGLER_SEND_METRICS ??= "false";

  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.WRANGLER_REGISTRY_PATH ??= ".wrangler/dev-registry";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      ...(managedLinux ? { host: "0.0.0.0", allowedHosts: ["terminal.local"] } : {}),
      ...(isCodexSeatbeltSandbox ? { watch: { useFsEvents: false, usePolling: true } } : {}),
    },
    plugins: [
      vinext(),
      sites({ mockAuth: !managedLinux }),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        ...(localPersistPath ? { persistState: { path: localPersistPath } } : {}),
        config: localBindingConfig,
      }),
    ],
  };
});
