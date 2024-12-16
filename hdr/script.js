import {
  vec3,
  mat4,
} from 'https://wgpu-matrix.org/dist/3.x/wgpu-matrix.module.js';

// Clear color for GPURenderPassDescriptor
const clearColor = { r: 0.2, g: 0.2, b: 0.2, a: 1.0 };

function makeVertex([x, y], [r, g, b, a]) {
  return [
    ...[x, y, 0, 1], // position
    ...[r, g, b, a], // color
    ...[0, 0, -1], // normal
  ];
}

// Vertex data for triangle
const vertexDataSize = 4 * 4 + 4 * 4 + 4 * 3; // position + color + normal
const vertices = new Float32Array([
  ...makeVertex([0, 0.6], [1, 1, 1, 1]),
  ...makeVertex([-0.5, -0.6], [1, 1, 1, 1]),
  ...makeVertex([0.5, -0.6], [5, 5, 5, 1]),
]);
const vertexCount = vertices.byteLength / vertexDataSize;

function makeInstance(offset, scale, rotDeg, tint) {
  const model = mat4.identity();
  mat4.translate(model, vec3.fromValues(offset[0], offset[1], 0), model);
  mat4.scale(model, vec3.fromValues(scale[0], scale[1], 1), model);
  mat4.rotateZ(model, rotDeg / 360 * Math.PI * 2, model);

  const mv = mat4.create();
  const mv_inv = mat4.create();

  return [
    ...tint,
    ...model,
    ...mv,
    ...mv_inv,
  ];
}

const instanceSize = 4*4 + 4*16 + 4*16 + 4*16; // tint + model + mvp + mvp_inv
const instances = new Float32Array([
  ...makeInstance([0, 0], [1, 1], 0, [1, 1, 1, 1]),
  ...makeInstance([0.5, 0.5], [0.5, 0.5], 0, [1, 0, 0, 1]),
  ...makeInstance([-0.5, -0.5], [0.5, 0.5], -30, [0, 1, 0, 1]),
  ...makeInstance([1, 0], [0.5, 0.5], 45, [0, 0, 1, 1]),
  ...makeInstance([-1, 0], [0.5, 0.5], 90, [1, 1, 0, 1]),
]);
const instanceCount = instances.byteLength / instanceSize;

function getInstanceParts(i) {
  const instance = instances.subarray(i * instanceSize / 4, (i + 1) * instanceSize / 4);
  const tint = instance.subarray(0, 4);
  const model = instance.subarray(4, 20);
  const mv = instance.subarray(20, 36);
  const mv_inv = instance.subarray(36, 52);

  return { tint, model, mv, mv_inv };
}

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

  const LocVertex = 0;
  const LocInstance = 3;

  // 5: Create a GPUVertexBufferLayout and GPURenderPipelineDescriptor to provide a definition of our render pipline
  const vertexBuffers = [
    {
      attributes: [
        {
          shaderLocation: LocVertex+0, // position
          offset: 0,
          format: 'float32x4'
        },
        {
          shaderLocation: LocVertex+1, // color
          offset: 4 * 4,
          format: 'float32x4'
        },
        {
          shaderLocation: LocVertex+2, // normal
          offset: 4 * 8,
          format: 'float32x3'
        },
      ],
      arrayStride: vertexDataSize,
      stepMode: 'vertex'
    },
    {
      attributes: [
        {
          shaderLocation: LocInstance+0, // tint
          offset: 0,
          format: 'float32x4',
        },
        {
          shaderLocation: LocInstance+1, // mvMatrix0
          offset: 4 * 16 + 4 * 4,
          format: 'float32x4',
        },
        {
          shaderLocation: LocInstance+2, // mvMatrix1
          offset: 4 * 16 + 4 * 8,
          format: 'float32x4',
        },
        {
          shaderLocation: LocInstance+3, // mvMatrix2
          offset: 4 * 16 + 4 * 12,
          format: 'float32x4',
        },
        {
          shaderLocation: LocInstance+4, // mvMatrix3
          offset: 4 * 16 + 4 * 16,
          format: 'float32x4',
        },
        {
          shaderLocation: LocInstance+5, // mvInvMatrix0
          offset: 4 * 16 + 4 * 20,
          format: 'float32x4',
        },
        {
          shaderLocation: LocInstance+6, // mvInvMatrix1
          offset: 4 * 16 + 4 * 24,
          format: 'float32x4',
        },
        {
          shaderLocation: LocInstance+7, // mvInvMatrix2
          offset: 4 * 16 + 4 * 28,
          format: 'float32x4',
        },
        {
          shaderLocation: LocInstance+8, // mvInvMatrix3
          offset: 4 * 16 + 4 * 32,
          format: 'float32x4',
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
    layout: 'auto',
    // Enable depth testing so that the fragment closest to the camera
    // is rendered in front.
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less',
      format: 'depth24plus',
    },
  };

  const depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  // 6: Create the actual render pipeline

  const renderPipeline = device.createRenderPipeline(pipelineDescriptor);

  // Uniforms
  const timeUniform = new Float32Array(1);
  const uniforms = new Float32Array(16);

  const timeBuffer = device.createBuffer({
    size: timeUniform.byteLength,
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

  const viewMatrix = mat4.create();

  const projectionMatrix = mat4.perspective((2 * Math.PI) / 5, aspect, 1, 100.0);

  function updateCamera(time) {
    mat4.identity(viewMatrix);
    mat4.translate(viewMatrix, vec3.fromValues(0, 0, -3), viewMatrix);
    mat4.rotateY(viewMatrix, time, viewMatrix);
  }

  function updateUniforms(time) {
    mat4.identity(uniforms);
    mat4.multiply(uniforms, projectionMatrix, uniforms);
  }

  function updateInstances(time) {
    for (let i = 0; i < instanceCount; i++) {
      const { tint, model, mv, mv_inv } = getInstanceParts(i);

      mat4.identity(mv);
      mat4.multiply(mv, viewMatrix, mv);
      mat4.multiply(mv, model, mv);
      mat4.rotateY(mv, time, mv);

      mat4.invert(mv, mv_inv);
    }
  }

  function frame(timestamp) {
    const time = timestamp / 1000;

    updateCamera(time);

    // Update uniforms
    timeUniform[0] = time;
    device.queue.writeBuffer(timeBuffer, 0, timeUniform, 0, timeUniform.length);

    updateUniforms(time);
    device.queue.writeBuffer(uniformBuffer, 0, uniforms, 0, uniforms.length);

    // Update instances
    updateInstances(time);
    device.queue.writeBuffer(instanceBuffer, 0, instances, 0, instances.length);

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
      depthStencilAttachment: {
        view: depthTexture.createView(),

        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
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
