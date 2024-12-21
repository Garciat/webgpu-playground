import { download } from '../common/utils.js';
import { main as art } from '../common/fullscreen-fragment-art-main.js';

async function main() {
  await art({
    fragmentCode: await download('frag.wgsl', 'text'),
  });
}

await main();
