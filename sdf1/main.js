import {
  RollingAverage,
  TimingManager,
  GPUTimingAdapter,
  TimingValuesDisplay,
} from '../common/webgpu-timing.js';

import { Screen } from '../common/display.js';

const timing = new TimingManager(
  new RollingAverage(),
  new RollingAverage(),
  new RollingAverage(),
);

const timingDisplay = new TimingValuesDisplay(document.body);

// Main function
async function init() {
  const {canvas, displayW, displayH} = Screen.setup(document.body, window.devicePixelRatio);

  const {adapter, device, context, canvasTextureFormat} = await Screen.gpu(navigator.gpu, canvas, {
    optionalFeatures: ['timestamp-query'],
  });

  const gpuTimingAdapter = new GPUTimingAdapter(device);

  const renderPipeline = device.createRenderPipeline({
    vertex: {
      module: device.createShaderModule({
        code: await fetch('../common/static-quad.vert.wgsl').then(response => response.text()),
      }),
    },
    fragment: {
      module: device.createShaderModule({
        code: await fetch('frag.wgsl').then(response => response.text()),
      }),
      targets: [
        {
          format: canvasTextureFormat,
        },
      ],
    },
    primitive: {
      topology: 'triangle-list',
    },
    layout: 'auto',
  });

  // Uniforms
  const uniformsData = new Float32Array(4 * 3);
  const uniformsData_time = uniformsData.subarray(0, 4);
  const uniformsData_resolution = uniformsData.subarray(4, 8);
  const uniformsData_mouse = uniformsData.subarray(8, 12);

  {
    uniformsData_resolution[0] = canvas.width;
    uniformsData_resolution[1] = canvas.height;
  }

  {
    // start at center
    let mx = displayW / 2;
    let my = displayH / 2;
    uniformsData_mouse[0] = mx * devicePixelRatio;
    uniformsData_mouse[1] = my * devicePixelRatio;
  }

  const uniformsBuffer = device.createBuffer({
    size: uniformsData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformBindGroup = device.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: uniformsBuffer,
        },
      },
    ],
  });

  canvas.addEventListener('mousemove', ev => {
    let b = canvas.getBoundingClientRect();
    let mx = ev.clientX - b.x;
    let my = ev.clientY - b.y;
    uniformsData_mouse[0] = mx * devicePixelRatio;
    uniformsData_mouse[1] = my * devicePixelRatio;
  });

  function updateUniforms(time) {
    uniformsData_time[0] = time;
  }

  function frame(timestamp) {
    timing.beginFrame(timestamp);

    const time = timestamp / 1000;

    updateUniforms(time);
    device.queue.writeBuffer(uniformsBuffer, 0, uniformsData);

    const commandEncoder = device.createCommandEncoder();

    const renderPassDescriptor = {
      colorAttachments: [
        {
          clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
          view: context.getCurrentTexture().createView()
        },
      ],
      ...gpuTimingAdapter.getPassDescriptorMixin(),
    };

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

    passEncoder.setPipeline(renderPipeline);
    passEncoder.setBindGroup(0, uniformBindGroup);
    passEncoder.draw(6);

    passEncoder.end();
    gpuTimingAdapter.trackPassEnd(commandEncoder);

    device.queue.submit([commandEncoder.finish()]);

    let timingValues = timing.endFrame(gpuTimingAdapter.getResult());
    timingDisplay.display(timingValues);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

init();
