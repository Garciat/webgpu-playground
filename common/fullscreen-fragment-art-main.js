import {
  RollingAverage,
  TimingManager,
  GPUTimingAdapter,
  TimingValuesDisplay,
} from '../common/webgpu-timing.js';

import { Screen } from '../common/display.js';

import { FullscreenFragmentArt } from '../common/fullscreen-fragment-art.js';

/**
 * @param {{fragmentCode: string}} _
 */
export async function main({fragmentCode}) {
  const pixelRatio = window.devicePixelRatio;
  const {canvas, displayW, displayH} = Screen.setup(document.body, pixelRatio);

  const {adapter, device, context, canvasTextureFormat} = await Screen.gpu(navigator.gpu, canvas, {
    optionalFeatures: ['timestamp-query'],
  });

  const renderer = new FullscreenFragmentArt({
    canvas,
    device,
    canvasTextureFormat,
    fragmentCode,
    gpuTiming: new GPUTimingAdapter(device),
  });

  const timing = new TimingManager(
    new RollingAverage(),
    new RollingAverage(),
    new RollingAverage(),
  );

  const timingDisplay = new TimingValuesDisplay(document.body);

  /**
   * @param {DOMHighResTimeStamp} timestamp
   */
  function frame(timestamp) {
    timing.beginFrame(timestamp);

    const commandEncoder = device.createCommandEncoder();

    renderer.render(timestamp, commandEncoder, context.getCurrentTexture().createView());

    device.queue.submit([commandEncoder.finish()]);

    let timingValues = timing.endFrame(renderer.readTiming());
    timingDisplay.display(timingValues);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
