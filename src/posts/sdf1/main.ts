import { downloadText } from "../../js/utils.ts";
import { main as art } from "../../js/fullscreen-fragment-art-main.ts";

async function main() {
  await art({
    fragmentCode: await downloadText("frag.wgsl"),
  });
}

await main();
