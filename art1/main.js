import { main as art } from '../common/fullscreen-fragment-art-main.js';

async function main() {
  await art({
    fragmentCode: await fetch('frag.wgsl').then(response => response.text()),
  });
}

await main();
