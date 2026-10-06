// Generates the Kit-native TypeScript client for the Selo program from the
// Anchor IDL into packages/sdk/src/generated (committed, so the app builds without Anchor).
// Run after `anchor build` whenever instructions, accounts, errors or events change.
import { readFileSync } from "node:fs";
import { rootNodeFromAnchor } from "@codama/nodes-from-anchor";
import { renderVisitor } from "@codama/renderers-js";
import { createFromRoot } from "codama";

const idl = JSON.parse(readFileSync("target/idl/selo.json", "utf8"));
const codama = createFromRoot(rootNodeFromAnchor(idl));

await codama.accept(
  renderVisitor("packages/sdk", {
    generatedFolder: "src/generated",
    deleteFolderBeforeRendering: true,
    syncPackageJson: false,
  }),
);
console.log("Generated packages/sdk/src/generated from target/idl/selo.json");
