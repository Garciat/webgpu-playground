import {
  createGPUTimingAdapter,
  RollingAverage,
  TimingManager,
  TimingValuesDisplay,
} from "./webgpu-timing.ts";

import { Screen } from "./display.ts";

import { FullscreenFragmentArt } from "./fullscreen-fragment-art.ts";

export async function main({ fragmentCode }: { fragmentCode: string }) {
  const pixelRatio = globalThis.devicePixelRatio;
  const { canvas } = Screen.setup(
    document.body,
    pixelRatio,
  );

  const { device, context, canvasTextureFormat } = await Screen.gpu(
    navigator.gpu,
    canvas,
    {
      optionalFeatures: ["timestamp-query"],
    },
  );

  const renderer = new FullscreenFragmentArt({
    canvas,
    device,
    canvasTextureFormat,
    fragmentCode,
    gpuTiming: createGPUTimingAdapter(device, { "gpu": {} }),
  });

  const timing = new TimingManager(
    new RollingAverage(),
    new RollingAverage(),
    { gpu: new RollingAverage() },
  );

  const timingDisplay = new TimingValuesDisplay(document.body);

  function frame(timestamp: DOMHighResTimeStamp) {
    timing.beginFrame(timestamp);

    const commandEncoder = device.createCommandEncoder();

    renderer.render(
      timestamp,
      commandEncoder,
      context.getCurrentTexture().createView(),
    );

    device.queue.submit([commandEncoder.finish()]);

    const timingValues = timing.endFrame(renderer.readTiming());
    timingDisplay.display(timingValues);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
