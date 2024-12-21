import {
  vec3,
  vec4,
  mat4,
} from 'https://wgpu-matrix.org/dist/3.x/wgpu-matrix.module.js';

import {
  RollingAverage,
  TimingManager,
  GPUTimingAdapter,
  TimingValuesDisplay,
} from '../common/webgpu-timing.js';

const timing = new TimingManager(
  new RollingAverage(),
  new RollingAverage(),
  new RollingAverage(),
);

const timingDisplay = new TimingValuesDisplay(document.body);

// Main function
async function init() {
  const textureFormat = 'rgba16float';

  const shaders = await fetch('shaders.wgsl').then(response => response.text());

  if (!navigator.gpu) {
    throw Error('WebGPU not supported.');
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw Error('Couldn\'t request WebGPU adapter.');
  }

  const canTimestamp = adapter.features.has('timestamp-query');

  const device = await adapter?.requestDevice({
    requiredFeatures: [
      ...(canTimestamp ? ['timestamp-query'] : []),
    ],
  });

  const gpuTimingAdapter = new GPUTimingAdapter(device);

  const shaderModule = device.createShaderModule({
    code: shaders
  });

  const canvas = document.querySelector('#gpuCanvas');

  const devicePixelRatio = window.devicePixelRatio;
  canvas.style.width = `${document.body.clientWidth}px`;
  canvas.style.height = `${document.body.clientHeight}px`;
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;

  const context = canvas.getContext('webgpu');

  context.configure({
    device: device,
    format: textureFormat,
    colorSpace: 'display-p3',
    toneMapping: {
      mode: 'extended',
    },
    alphaMode: 'premultiplied',
  });

  const pipelineDescriptor = {
    vertex: {
      module: shaderModule,
      entryPoint: 'vertex_main',
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fragment_main',
      targets: [
        {
          format: textureFormat
        },
      ],
    },
    primitive: {
      topology: 'triangle-list',
    },
    layout: 'auto',
  };

  const renderPipeline = device.createRenderPipeline(pipelineDescriptor);

  // Uniforms
  const uniformsData = new Float32Array(4 * 2);
  const uniformsData_time = uniformsData.subarray(0, 4);
  const uniformsData_resolution = uniformsData.subarray(4, 8);

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

  function updateUniforms(time) {
    uniformsData_time[0] = time;
    uniformsData_resolution[0] = canvas.width;
    uniformsData_resolution[1] = canvas.height;
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
    };

    const passEncoder = gpuTimingAdapter.beginRenderPass(commandEncoder, renderPassDescriptor);

    passEncoder.setPipeline(renderPipeline);
    passEncoder.setBindGroup(0, uniformBindGroup);
    passEncoder.draw(6);

    passEncoder.end();

    device.queue.submit([commandEncoder.finish()]);

    let timingValues = timing.endFrame(gpuTimingAdapter.getResult());
    timingDisplay.display(timingValues);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

init();
