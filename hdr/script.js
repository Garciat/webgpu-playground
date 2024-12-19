import {
  vec3,
  vec4,
  mat4,
} from 'https://wgpu-matrix.org/dist/3.x/wgpu-matrix.module.js';

// Clear color for GPURenderPassDescriptor
const clearColor = { r: 0.2, g: 0.2, b: 0.2, a: 1.0 };

function makeVertex([x, y, z] = [0, 0, 0], [r, g, b, a] = [1, 1, 1, 1], [u, v] = [0, 0], [nx, ny, nz] = [0, 0, -1]) {
  return [
    ...[x, y, z ?? 0, 1], // position
    ...[r, g, b, a], // color
    ...[nx, ny, nz], // normal
    ...[u, v], // uv
  ];
}

function makeCube() {
  return [
    // Front face
    ...makeVertex([-1, -1,  1], [1, 0, 0, 1], [0, 0], [0, 0, 1]),
    ...makeVertex([ 1, -1,  1], [0, 1, 0, 1], [1, 0], [0, 0, 1]),
    ...makeVertex([ 1,  1,  1], [0, 0, 1, 1], [1, 1], [0, 0, 1]),
    ...makeVertex([-1,  1,  1], [1, 1, 1, 1], [0, 1], [0, 0, 1]),
    ...makeVertex([-1, -1,  1], [1, 0, 0, 1], [0, 0], [0, 0, 1]),
    ...makeVertex([ 1,  1,  1], [0, 0, 1, 1], [1, 1], [0, 0, 1]),
    // Back face
    ...makeVertex([-1, -1, -1], [1, 0, 0, 1], [0, 0], [0, 0, -1]),
    ...makeVertex([-1,  1, -1], [0, 1, 0, 1], [0, 1], [0, 0, -1]),
    ...makeVertex([ 1,  1, -1], [0, 0, 1, 1], [1, 1], [0, 0, -1]),
    ...makeVertex([ 1, -1, -1], [1, 1, 1, 1], [1, 0], [0, 0, -1]),
    ...makeVertex([-1, -1, -1], [1, 0, 0, 1], [0, 0], [0, 0, -1]),
    ...makeVertex([ 1,  1, -1], [0, 0, 1, 1], [1, 1], [0, 0, -1]),
    // Top face
    ...makeVertex([-1,  1, -1], [1, 0, 0, 1], [0, 0], [0, 1, 0]),
    ...makeVertex([-1,  1,  1], [0, 1, 0, 1], [0, 1], [0, 1, 0]),
    ...makeVertex([ 1,  1,  1], [0, 0, 1, 1], [1, 1], [0, 1, 0]),
    ...makeVertex([ 1,  1, -1], [1, 1, 1, 1], [1, 0], [0, 1, 0]),
    ...makeVertex([-1,  1, -1], [1, 0, 0, 1], [0, 0], [0, 1, 0]),
    ...makeVertex([ 1,  1,  1], [0, 0, 1, 1], [1, 1], [0, 1, 0]),
    // Bottom face
    ...makeVertex([-1, -1, -1], [1, 0, 0, 1], [0, 0], [0, -1, 0]),
    ...makeVertex([ 1, -1, -1], [0, 1, 0, 1], [1, 0], [0, -1, 0]),
    ...makeVertex([ 1, -1,  1], [0, 0, 1, 1], [1, 1], [0, -1, 0]),
    ...makeVertex([-1, -1,  1], [1, 1, 1, 1], [0, 1], [0, -1, 0]),
    ...makeVertex([-1, -1, -1], [1, 0, 0, 1], [0, 0], [0, -1, 0]),
    ...makeVertex([ 1, -1,  1], [0, 0, 1, 1], [1, 1], [0, -1, 0]),
    // Right face
    ...makeVertex([ 1, -1, -1], [1, 0, 0, 1], [0, 0], [1, 0, 0]),
    ...makeVertex([ 1,  1, -1], [0, 1, 0, 1], [0, 1], [1, 0, 0]),
    ...makeVertex([ 1,  1,  1], [0, 0, 1, 1], [1, 1], [1, 0, 0]),
    ...makeVertex([ 1, -1,  1], [1, 1, 1, 1], [1, 0], [1, 0, 0]),
    ...makeVertex([ 1, -1, -1], [1, 0, 0, 1], [0, 0], [1, 0, 0]),
    ...makeVertex([ 1,  1,  1], [0, 0, 1, 1], [1, 1], [1, 0, 0]),
    // Left face
    ...makeVertex([-1, -1, -1], [1, 0, 0, 1], [0, 0], [-1, 0, 0]),
    ...makeVertex([-1, -1,  1], [0, 1, 0, 1], [1, 0], [-1, 0, 0]),
    ...makeVertex([-1,  1,  1], [0, 0, 1, 1], [1, 1], [-1, 0, 0]),
    ...makeVertex([-1,  1, -1], [1, 1, 1, 1], [0, 1], [-1, 0, 0]),
    ...makeVertex([-1, -1, -1], [1, 0, 0, 1], [0, 0], [-1, 0, 0]),
    ...makeVertex([-1,  1,  1], [0, 0, 1, 1], [1, 1], [-1, 0, 0]),
  ];
}

// Vertex data for triangle
const vertexDataSize = 4 * makeVertex().length;
const vertices = new Float32Array([
  ...makeCube(),
]);
const vertexCount = vertices.byteLength / vertexDataSize;

function makeInstance([x, y, z] = [0, 0, 0], [sx, sy, sz] = [1, 1, 1], rotDeg = 0, tint = [1, 1, 1, 1]) {
  const model = mat4.identity();
  mat4.translate(model, vec3.fromValues(x, y, z), model);
  mat4.scale(model, vec3.fromValues(sx, sy, sz), model);
  mat4.rotateZ(model, rotDeg / 360 * Math.PI * 2, model);

  const mvMatrix = mat4.create();
  const normalMatrix = mat4.create();

  return [
    ...tint,
    ...model,
    ...mvMatrix,
    ...normalMatrix,
  ];
}

const instanceSize = 4 * makeInstance().length;
const instances = new Float32Array([
  ...makeInstance([0, 0, 0], [0.5, 0.5, 0.5], 0, [1, 1, 1, 1]),
  ...makeInstance([0, 0, -3], [0.05, 0.05, 0.05], 0, [1, 1, 1, 1]), // light
]);
const instanceCount = instances.byteLength / instanceSize;

function getInstanceParts(i) {
  const instance = instances.subarray(i * instanceSize / 4, (i + 1) * instanceSize / 4);
  const tint = instance.subarray(0, 4);
  const model = instance.subarray(4, 20);
  const mvMatrix = instance.subarray(20, 36);
  const normalMatrix = instance.subarray(36, 52);

  return { tint, model, mvMatrix, normalMatrix };
}

function makeLight([x, y, z] = [0, 0, 0], [r, g, b] = [1, 1, 1]) {
  // using vec3 for either caused some weird alignment issue that I couldn't figure out
  // so using vec4 sizes for position and color
  return [
    x, y, z, 1,
    r, g, b, 1,
  ];
}

const lightSize = 4 * makeLight().length;
const lights = new Float32Array([
  ...makeLight([0, 0, -3], [10, 10, 10]),
]);
const lightCount = lights.byteLength / lightSize;

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
  device.queue.writeBuffer(vertexBuffer, 0, vertices);

  const instanceBuffer = device.createBuffer({
    size: instances.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(instanceBuffer, 0, instances);

  const lightBuffer = device.createBuffer({
    size: lights.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(lightBuffer, 0, lights);

  const LocVertex = 0;
  const LocInstance = 4;

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
        {
          shaderLocation: LocVertex+3, // uv
          offset: 4 * 11,
          format: 'float32x2'
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
          shaderLocation: LocInstance+5, // normalMatrix0
          offset: 4 * 16 + 4 * 20,
          format: 'float32x4',
        },
        {
          shaderLocation: LocInstance+6, // normalMatrix1
          offset: 4 * 16 + 4 * 24,
          format: 'float32x4',
        },
        {
          shaderLocation: LocInstance+7, // normalMatrix2
          offset: 4 * 16 + 4 * 28,
          format: 'float32x4',
        },
        {
          shaderLocation: LocInstance+8, // normalMatrix3
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
      topology: 'triangle-list',
      cullMode: 'back',
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
  const camera = new Float32Array(32);

  const timeBuffer = device.createBuffer({
    size: timeUniform.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const cameraBuffer = device.createBuffer({
    size: camera.byteLength,
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
          buffer: cameraBuffer,
        },
      },
    ],
  });

  const lightsBindGroup = device.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(1),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: lightBuffer,
        },
      },
    ],
  });

  const aspect = canvas.width / canvas.height;

  const projectionMatrix = camera.subarray(0, 16);
  mat4.perspective((2 * Math.PI) / 5, aspect, 1, 100.0, projectionMatrix);

  const viewMatrix = camera.subarray(16, 32);

  function updateCamera(time) {
    const pos = vec3.fromValues(0, 0, -5);

    mat4.identity(viewMatrix);
    mat4.translate(viewMatrix, pos, viewMatrix);
    // mat4.rotateX(viewMatrix, Math.PI / 4, viewMatrix);
    mat4.rotateY(viewMatrix, time, viewMatrix);
  }

  function updateUniforms(time) {
    timeUniform[0] = time;
  }

  function updateInstances(time) {
    for (let i = 0; i < instanceCount; i++) {
      const { tint, model, mvMatrix, normalMatrix } = getInstanceParts(i);

      mat4.identity(mvMatrix);
      mat4.multiply(mvMatrix, viewMatrix, mvMatrix);
      mat4.multiply(mvMatrix, model, mvMatrix);

      if (i === 0) {
        mat4.rotateY(mvMatrix, time, mvMatrix);
        mat4.rotateX(mvMatrix, time, mvMatrix);
      }

      mat4.invert(mvMatrix, normalMatrix);
      mat4.transpose(normalMatrix, normalMatrix);
    }
  }

  function frame(timestamp) {
    const time = timestamp / 1000;

    updateCamera(time);
    updateUniforms(time);
    updateInstances(time);

    // Update uniforms
    device.queue.writeBuffer(timeBuffer, 0, timeUniform);
    device.queue.writeBuffer(cameraBuffer, 0, camera);
    device.queue.writeBuffer(lightBuffer, 0, lights);
    device.queue.writeBuffer(instanceBuffer, 0, instances);

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
    passEncoder.setBindGroup(1, lightsBindGroup);
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
