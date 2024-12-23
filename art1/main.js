import { downloadText } from '../common/utils.js';
import { main as art } from '../common/fullscreen-fragment-art-main.js';

async function main() {
  await art({
    fragmentCode: await downloadText('frag.wgsl'),
  });
}

await main();
