/**
 * Demo mode, local only: serves the devnet demo keypairs from
 * scripts/wallets/demo so the video can switch roles without a wallet
 * extension. Answers 404 unless SELO_DEMO_MODE=1 (in app/.env.local), the
 * request is addressed to localhost and the app is not running on Vercel.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROLES = ["supplier", "buyer", "lenderA", "lenderB"] as const;

const notFound = () => new Response("Not found", { status: 404 });

export async function GET(request: Request) {
  if (process.env.SELO_DEMO_MODE !== "1" || process.env.VERCEL) {
    return notFound();
  }
  // request.url is always "localhost" under `next start`; check the real Host.
  // `pnpm demo` also binds the server to 127.0.0.1 only.
  const host = (request.headers.get("host") ?? "").replace(/:\d+$/, "");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) return notFound();

  const dir =
    process.env.SELO_DEMO_WALLETS ??
    join(process.cwd(), "..", "scripts", "wallets", "demo");
  try {
    const wallets = await Promise.all(
      ROLES.map(async (role) => ({
        role,
        secretKey: JSON.parse(
          await readFile(join(dir, `${role}.json`), "utf8"),
        ) as number[],
      })),
    );
    return Response.json(
      { wallets },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("Demo mode: could not read the demo wallets in", dir, err);
    return notFound();
  }
}
