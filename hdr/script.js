import {
  vec3,
  mat4,
} from 'https://wgpu-matrix.org/dist/3.x/wgpu-matrix.module.js';

// Clear color for GPURenderPassDescriptor
const clearColor = { r: 0.2, g: 0.2, b: 0.2, a: 1.0 };

// Vertex data for triangle
const vertexDataSize = 4*4 + 4*4; // position + color
const vertices = new Float32Array([
  0.0, 0.6, 0, 1, 1, 1, 1, 1,
  -0.5, -0.6, 0, 1, 1, 1, 1, 1,
  0.5, -0.6, 0, 1, 5, 5, 5, 1
]);
const vertexCount = vertices.byteLength / vertexDataSize;

function makeInstance(offset, scale, rotDeg, tint) {
  const m = mat4.create();
  mat4.identity(m);
  mat4.translate(m, [offset[0], offset[1], 0], m);
  mat4.rotate(m, [0, 0, 1], rotDeg/360*Math.PI*2, m);
  mat4.scale(m, [scale[0], scale[1], 1], m);
  mat4.transpose(m, m); // transpose to column-major for GPU
  return [...m, ...tint];
}

const instanceSize = 4*16 + 4*4; // tansform(mat4x4f) + tint(vec4f)
const instances = new Float32Array([
  ...makeInstance([0, 0], [1, 1], 0, [1, 1, 1, 1]),
  ...makeInstance([0.5, 0.5], [0.5, 0.5], 0, [1, 0, 0, 1]),
  ...makeInstance([-0.5, -0.5], [0.5, 0.5], -30, [0, 1, 0, 1]),
  ...makeInstance([1, 0], [0.5, 0.5], 45, [0, 0, 1, 1]),
  ...makeInstance([-1, 0], [0.5, 0.5], 90, [1, 1, 0, 1]),
]);
const instanceCount = instances.byteLength / instanceSize;

// Main function
async function init() {
  const textureFormat = 'rgba16float';

  // 0: download shader

  const shaders = await fetch('shaders.wgsl').then(response => response.text());

  // 1: request adapter and device
  if (!navigator.gpu) {
    throw Error('WebGPU not supported.');
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw Error('Couldn\'t request WebGPU adapter.');
  }

  let device = await adapter.requestDevice();

  // 2: Create a shader module from the shaders template literal
  const shaderModule = device.createShaderModule({
    code: shaders
  });

  // 3: Get reference to the canvas to render on
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
    alphaMode: 'premultiplied'
  });

  // 4: Create vertex buffer to contain vertex data
  const vertexBuffer = device.createBuffer({
    size: vertices.byteLength, // make it big enough to store vertices in
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  // Copy the vertex data over to the GPUBuffer using the writeBuffer() utility function
  device.queue.writeBuffer(vertexBuffer, 0, vertices, 0, vertices.length);

  const instanceBuffer = device.createBuffer({
    size: instances.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(instanceBuffer, 0, instances, 0, instances.length);

  // 5: Create a GPUVertexBufferLayout and GPURenderPipelineDescriptor to provide a definition of our render pipline
  const vertexBuffers = [
    {
      attributes: [
        {
          shaderLocation: 0, // position
          offset: 0,
          format: 'float32x4'
        },
        {
          shaderLocation: 1, // color
          offset: 4 * 4,
          format: 'float32x4'
        },
      ],
      arrayStride: vertexDataSize,
      stepMode: 'vertex'
    },
    {
      attributes: [
        {
          shaderLocation: 2, // transform_v1
          offset: 0,
          format: 'float32x4'
        },
        {
          shaderLocation: 3, // transform_v2
          offset: 4 * 4,
          format: 'float32x4'
        },
        {
          shaderLocation: 4, // transform_v3
          offset: 8 * 4,
          format: 'float32x4'
        },
        {
          shaderLocation: 5, // transform_v4
          offset: 12 * 4,
          format: 'float32x4'
        },
        {
          shaderLocation: 6, // tint
          offset: 16 * 4,
          format: 'float32x4'
        },
      ],
      arrayStride: instanceSize,
      stepMode: 'instance'
    },
  ];

  const pipelineDescriptor = {
    vertex: {
      module: shaderModule,
      entryPoint: 'vertex_main',
      buffers: vertexBuffers
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
      topology: 'triangle-list'
    },
    layout: 'auto'
  };

  // 6: Create the actual render pipeline

  const renderPipeline = device.createRenderPipeline(pipelineDescriptor);

  // Uniforms
  const time = new Float32Array(1);
  const uniforms = new Float32Array(16);

  const timeBuffer = device.createBuffer({
    size: time.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformBuffer = device.createBuffer({
    size: uniforms.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformBindGroup = device.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: timeBuffer,
        },
      },
      {
        binding: 1,
        resource: {
          buffer: uniformBuffer,
        },
      },
    ],
  });

  const aspect = canvas.width / canvas.height;
  const projectionMatrix = mat4.perspective((2 * Math.PI) / 5, aspect, 1, 100.0);
  const modelViewProjectionMatrix = uniforms.subarray(0, 16);

  function updateTransformationMatrix(timestamp) {
    const viewMatrix = mat4.identity();
    mat4.translate(viewMatrix, vec3.fromValues(0, 0, -2), viewMatrix);
    mat4.multiply(projectionMatrix, viewMatrix, modelViewProjectionMatrix);
  }

  function frame(timestamp) {
    // Update uniforms
    time[0] = timestamp / 1000;
    device.queue.writeBuffer(timeBuffer, 0, time, 0, time.length);

    updateTransformationMatrix(timestamp);
    device.queue.writeBuffer(uniformBuffer, 0, uniforms, 0, uniforms.length);

    // 7: Create GPUCommandEncoder to issue commands to the GPU
    // Note: render pass descriptor, command encoder, etc. are destroyed after use, fresh one needed for each frame.
    const commandEncoder = device.createCommandEncoder();

    // 8: Create GPURenderPassDescriptor to tell WebGPU which texture to draw into, then initiate render pass

    const renderPassDescriptor = {
      colorAttachments: [
        {
          clearValue: clearColor,
          loadOp: 'clear',
          storeOp: 'store',
          view: context.getCurrentTexture().createView()
        },
      ],
    };

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

    // 9: Draw the triangle

    passEncoder.setPipeline(renderPipeline);
    passEncoder.setBindGroup(0, uniformBindGroup);
    passEncoder.setVertexBuffer(0, vertexBuffer);
    passEncoder.setVertexBuffer(1, instanceBuffer);
    passEncoder.draw(vertexCount, instanceCount);

    // End the render pass
    passEncoder.end();

    // 10: End frame by passing array of command buffers to command queue for execution
    device.queue.submit([commandEncoder.finish()]);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

init();
