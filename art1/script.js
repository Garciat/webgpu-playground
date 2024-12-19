import {
  vec3,
  vec4,
  mat4,
} from 'https://wgpu-matrix.org/dist/3.x/wgpu-matrix.module.js';

import { RollingAverage, TimingHelper } from '../common/webgpu-timing.js';

const fpsAverage = new RollingAverage();
const jsAverage = new RollingAverage();
const gpuAverage = new RollingAverage();

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

  const timingHelper = new TimingHelper(device);

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

  let then = 0;
  function frame(now) {
    const time = now / 1000;

    const deltaTime = time - then;
    then = time;

    const startTime = performance.now();

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

    const passEncoder = timingHelper.beginRenderPass(commandEncoder, renderPassDescriptor);

    passEncoder.setPipeline(renderPipeline);
    passEncoder.setBindGroup(0, uniformBindGroup);
    passEncoder.draw(6);

    passEncoder.end();

    device.queue.submit([commandEncoder.finish()]);

    timingHelper.getResult().then(gpuTime => {
      gpuAverage.addSample(gpuTime / 1000);
    });

    const jsTime = performance.now() - startTime;

    fpsAverage.addSample(1 / deltaTime);
    jsAverage.addSample(jsTime);

    window.myPerformanceInfo.textContent = `\
fps: ${fpsAverage.get().toFixed(1)}
js: ${jsAverage.get().toFixed(3)}ms
gpu: ${canTimestamp ? `${gpuAverage.get().toFixed(1)}µs` : 'N/A'}
`;

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

init();
