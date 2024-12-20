import {
  vec3,
  vec4,
  mat4,
} from 'https://wgpu-matrix.org/dist/3.x/wgpu-matrix.module.js';

import { download } from '../common/utils.js';

import {
  RollingAverage,
  TimingManager,
  GPUTimingAdapter,
  TimingValuesDisplay,
} from '../common/webgpu-timing.js';

import { Screen } from '../common/display.js';

function makeVertex([x, y, z] = [0, 0, 0], [r, g, b, a] = [1, 1, 1, 1], [u, v] = [0, 0], [nx, ny, nz] = [0, 0, -1]) {
  return [
    ...[x, y, z ?? 0, 1], // position
    ...[r, g, b, a], // color
    ...[nx, ny, nz], // normal
    ...[u, v], // uv
  ];
}

const vertexDataSize = 4 * makeVertex().length;

function makeInstance([x, y, z] = [0, 0, 0], [sx, sy, sz] = [1, 1, 1], [rx, ry, rz] = [0, 0, 0], tint = [1, 1, 1, 1]) {
  const model = mat4.identity();
  mat4.translate(model, vec3.fromValues(x, y, z), model);
  mat4.scale(model, vec3.fromValues(sx, sy, sz), model);
  mat4.rotateX(model, rx, model);
  mat4.rotateY(model, ry, model);
  mat4.rotateZ(model, rz, model);

  const mvMatrix = mat4.create();
  const normalMatrix = mat4.create();

  return [
    ...tint,
    ...model,
    ...mvMatrix,
    ...normalMatrix,
  ];
}

const instanceDataSize = 4 * makeInstance().length;

function makeCube() {
  return [
    // Front face
    ...makeVertex([-1, -1, 1], [1, 0, 0, 1], [0, 0], [0, 0, 1]),
    ...makeVertex([1, -1, 1], [0, 1, 0, 1], [1, 0], [0, 0, 1]),
    ...makeVertex([1, 1, 1], [0, 0, 1, 1], [1, 1], [0, 0, 1]),
    ...makeVertex([-1, 1, 1], [1, 1, 1, 1], [0, 1], [0, 0, 1]),
    ...makeVertex([-1, -1, 1], [1, 0, 0, 1], [0, 0], [0, 0, 1]),
    ...makeVertex([1, 1, 1], [0, 0, 1, 1], [1, 1], [0, 0, 1]),
    // Back face
    ...makeVertex([-1, -1, -1], [1, 0, 0, 1], [0, 0], [0, 0, -1]),
    ...makeVertex([-1, 1, -1], [0, 1, 0, 1], [0, 1], [0, 0, -1]),
    ...makeVertex([1, 1, -1], [0, 0, 1, 1], [1, 1], [0, 0, -1]),
    ...makeVertex([1, -1, -1], [1, 1, 1, 1], [1, 0], [0, 0, -1]),
    ...makeVertex([-1, -1, -1], [1, 0, 0, 1], [0, 0], [0, 0, -1]),
    ...makeVertex([1, 1, -1], [0, 0, 1, 1], [1, 1], [0, 0, -1]),
    // Top face
    ...makeVertex([-1, 1, -1], [1, 0, 0, 1], [0, 0], [0, 1, 0]),
    ...makeVertex([-1, 1, 1], [0, 1, 0, 1], [0, 1], [0, 1, 0]),
    ...makeVertex([1, 1, 1], [0, 0, 1, 1], [1, 1], [0, 1, 0]),
    ...makeVertex([1, 1, -1], [1, 1, 1, 1], [1, 0], [0, 1, 0]),
    ...makeVertex([-1, 1, -1], [1, 0, 0, 1], [0, 0], [0, 1, 0]),
    ...makeVertex([1, 1, 1], [0, 0, 1, 1], [1, 1], [0, 1, 0]),
    // Bottom face
    ...makeVertex([-1, -1, -1], [1, 0, 0, 1], [0, 0], [0, -1, 0]),
    ...makeVertex([1, -1, -1], [0, 1, 0, 1], [1, 0], [0, -1, 0]),
    ...makeVertex([1, -1, 1], [0, 0, 1, 1], [1, 1], [0, -1, 0]),
    ...makeVertex([-1, -1, 1], [1, 1, 1, 1], [0, 1], [0, -1, 0]),
    ...makeVertex([-1, -1, -1], [1, 0, 0, 1], [0, 0], [0, -1, 0]),
    ...makeVertex([1, -1, 1], [0, 0, 1, 1], [1, 1], [0, -1, 0]),
    // Right face
    ...makeVertex([1, -1, -1], [1, 0, 0, 1], [0, 0], [1, 0, 0]),
    ...makeVertex([1, 1, -1], [0, 1, 0, 1], [0, 1], [1, 0, 0]),
    ...makeVertex([1, 1, 1], [0, 0, 1, 1], [1, 1], [1, 0, 0]),
    ...makeVertex([1, -1, 1], [1, 1, 1, 1], [1, 0], [1, 0, 0]),
    ...makeVertex([1, -1, -1], [1, 0, 0, 1], [0, 0], [1, 0, 0]),
    ...makeVertex([1, 1, 1], [0, 0, 1, 1], [1, 1], [1, 0, 0]),
    // Left face
    ...makeVertex([-1, -1, -1], [1, 0, 0, 1], [0, 0], [-1, 0, 0]),
    ...makeVertex([-1, -1, 1], [0, 1, 0, 1], [1, 0], [-1, 0, 0]),
    ...makeVertex([-1, 1, 1], [0, 0, 1, 1], [1, 1], [-1, 0, 0]),
    ...makeVertex([-1, 1, -1], [1, 1, 1, 1], [0, 1], [-1, 0, 0]),
    ...makeVertex([-1, -1, -1], [1, 0, 0, 1], [0, 0], [-1, 0, 0]),
    ...makeVertex([-1, 1, 1], [0, 0, 1, 1], [1, 1], [-1, 0, 0]),
  ];
}

function makePlane(divisions) {
  const vertices = [];
  const step = 1 / divisions;
  for (let x = 0; x < divisions; x++) {
    for (let y = 0; y < divisions; y++) {
      const x0 = x * step - 0.5;
      const x1 = (x + 1) * step - 0.5;
      const y0 = y * step - 0.5;
      const y1 = (y + 1) * step - 0.5;

      vertices.push(
        ...makeVertex([x0, y0, 0], [1, 1, 1, 1], [0, 0], [0, 0, 1]),
        ...makeVertex([x1, y0, 0], [1, 1, 1, 1], [1, 0], [0, 0, 1]),
        ...makeVertex([x1, y1, 0], [1, 1, 1, 1], [1, 1], [0, 0, 1]),
        ...makeVertex([x0, y1, 0], [1, 1, 1, 1], [0, 1], [0, 0, 1]),
        ...makeVertex([x0, y0, 0], [1, 1, 1, 1], [0, 0], [0, 0, 1]),
        ...makeVertex([x1, y1, 0], [1, 1, 1, 1], [1, 1], [0, 0, 1]),
      );
    }
  }
  return vertices;
}

// Vertex data for triangle
const cubeVertexData = new Float32Array([
  ...makeCube(),
]);
const cubeVertexCount = cubeVertexData.byteLength / vertexDataSize;

const cubeInstanceData = new Float32Array([
  ...makeInstance([0, 0, 0], [0.5, 0.5, 0.5], [0, 0, 0], [1, 1, 1, 1]),
  ...makeInstance([0, 0, -3], [0.05, 0.05, 0.05], [0, 0, 0], [1, 1, 1, 1]), // light
]);
const cubeInstances = cubeInstanceData.byteLength / instanceDataSize;

const planeVertexData = new Float32Array([
  ...makePlane(10),
]);
const planeVertexCount = planeVertexData.byteLength / vertexDataSize;

const planeInstanceData = new Float32Array([
  ...makeInstance([0, -2, 0], [20, 20, 20], [-Math.PI / 2, 0, 0], [1, 1, 1, 1]),
]);
const planeInstances = planeInstanceData.byteLength / instanceDataSize;

function getInstanceParts(data, i) {
  const instance = data.subarray(i * instanceDataSize / 4, (i + 1) * instanceDataSize / 4);
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

async function main() {
  const {canvas, displayW, displayH} = Screen.setup(document.body, window.devicePixelRatio);

  const {adapter, device, context, canvasTextureFormat} = await Screen.gpu(navigator.gpu, canvas, {
    optionalFeatures: ['timestamp-query'],
  });

  const gpuTimingAdapter = new GPUTimingAdapter(device);

  const cubeVertexBuffer = device.createBuffer({
    size: cubeVertexData.byteLength, // make it big enough to store vertices in
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(cubeVertexBuffer, 0, cubeVertexData);

  const cubeInstanceBuffer = device.createBuffer({
    size: cubeInstanceData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(cubeInstanceBuffer, 0, cubeInstanceData);

  const planeVertexBuffer = device.createBuffer({
    size: planeVertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(planeVertexBuffer, 0, planeVertexData);

  const planeInstanceBuffer = device.createBuffer({
    size: planeInstanceData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(planeInstanceBuffer, 0, planeInstanceData);

  const lightBuffer = device.createBuffer({
    size: lights.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(lightBuffer, 0, lights);

  const LocVertex = 0;
  const LocInstance = 4;

  const vertexBufferLayout = [
    {
      attributes: [
        {
          shaderLocation: LocVertex + 0, // position
          offset: 0,
          format: 'float32x4'
        },
        {
          shaderLocation: LocVertex + 1, // color
          offset: 4 * 4,
          format: 'float32x4'
        },
        {
          shaderLocation: LocVertex + 2, // normal
          offset: 4 * 8,
          format: 'float32x3'
        },
        {
          shaderLocation: LocVertex + 3, // uv
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
          shaderLocation: LocInstance + 0, // tint
          offset: 0,
          format: 'float32x4',
        },
        {
          shaderLocation: LocInstance + 1, // mvMatrix0
          offset: 4 * 16 + 4 * 4,
          format: 'float32x4',
        },
        {
          shaderLocation: LocInstance + 2, // mvMatrix1
          offset: 4 * 16 + 4 * 8,
          format: 'float32x4',
        },
        {
          shaderLocation: LocInstance + 3, // mvMatrix2
          offset: 4 * 16 + 4 * 12,
          format: 'float32x4',
        },
        {
          shaderLocation: LocInstance + 4, // mvMatrix3
          offset: 4 * 16 + 4 * 16,
          format: 'float32x4',
        },
        {
          shaderLocation: LocInstance + 5, // normalMatrix0
          offset: 4 * 16 + 4 * 20,
          format: 'float32x4',
        },
        {
          shaderLocation: LocInstance + 6, // normalMatrix1
          offset: 4 * 16 + 4 * 24,
          format: 'float32x4',
        },
        {
          shaderLocation: LocInstance + 7, // normalMatrix2
          offset: 4 * 16 + 4 * 28,
          format: 'float32x4',
        },
        {
          shaderLocation: LocInstance + 8, // normalMatrix3
          offset: 4 * 16 + 4 * 32,
          format: 'float32x4',
        },
      ],
      arrayStride: instanceDataSize,
      stepMode: 'instance'
    },
  ];

  const shaders = await download('shaders.wgsl', 'text');

  const shaderModule = device.createShaderModule({
    code: shaders
  });

  const pipelineDescriptor = {
    vertex: {
      module: shaderModule,
      entryPoint: 'vertex_main',
      buffers: vertexBufferLayout
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fragment_main',
      targets: [
        {
          format: canvasTextureFormat
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

  let cubeTexture;
  {
    const imageBitmap = await createImageBitmap(
      await download('lulu.png', 'blob'),
      {
        colorSpaceConversion: 'none',
        resizeQuality: 'high',
        premultiplyAlpha: 'none',
      },
    );

    cubeTexture = device.createTexture({
      size: [imageBitmap.width, imageBitmap.height, 1],
      format: canvasTextureFormat,
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    device.queue.copyExternalImageToTexture(
      { source: imageBitmap },
      { texture: cubeTexture, colorSpace: 'display-p3', premultipliedAlpha: false },
      [imageBitmap.width, imageBitmap.height]
    );
  }

  let grassTexture;
  {
    const imageBitmap = await createImageBitmap(await download('grass.jpg', 'blob'),);

    grassTexture = device.createTexture({
      size: [imageBitmap.width, imageBitmap.height, 1],
      format: canvasTextureFormat,
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    device.queue.copyExternalImageToTexture(
      { source: imageBitmap },
      { texture: grassTexture },
      [imageBitmap.width, imageBitmap.height]
    );
  }

  const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
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

  const cubeTextureBindGroup = device.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(2),
    entries: [
      {
        binding: 0,
        resource: sampler,
      },
      {
        binding: 1,
        resource: cubeTexture.createView(),
      },
    ],
  });

  const grassTextureBindGroup = device.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(2),
    entries: [
      {
        binding: 0,
        resource: sampler,
      },
      {
        binding: 1,
        resource: grassTexture.createView(),
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
    mat4.rotateX(viewMatrix, Math.PI / 8, viewMatrix);
    mat4.rotateY(viewMatrix, time, viewMatrix);
  }

  function updateUniforms(time) {
    timeUniform[0] = time;
  }

  function updateInstances(time) {
    for (let i = 0; i < cubeInstances; i++) {
      const { tint, model, mvMatrix, normalMatrix } = getInstanceParts(cubeInstanceData, i);

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

    for (let i = 0; i < planeInstances; i++) {
      const { tint, model, mvMatrix, normalMatrix } = getInstanceParts(planeInstanceData, i);

      mat4.identity(mvMatrix);
      mat4.multiply(mvMatrix, viewMatrix, mvMatrix);
      mat4.multiply(mvMatrix, model, mvMatrix);

      mat4.invert(mvMatrix, normalMatrix);
      mat4.transpose(normalMatrix, normalMatrix);
    }
  }

  const timing = new TimingManager(
    new RollingAverage(),
    new RollingAverage(),
    new RollingAverage(),
  );

  const timingDisplay = new TimingValuesDisplay(document.body);

  function frame(timestamp) {
    timing.beginFrame(timestamp);

    const time = timestamp / 1000;

    updateCamera(time);
    updateUniforms(time);
    updateInstances(time);

    // Update uniforms
    device.queue.writeBuffer(timeBuffer, 0, timeUniform);
    device.queue.writeBuffer(cameraBuffer, 0, camera);
    device.queue.writeBuffer(lightBuffer, 0, lights);
    device.queue.writeBuffer(cubeInstanceBuffer, 0, cubeInstanceData);
    device.queue.writeBuffer(planeInstanceBuffer, 0, planeInstanceData);

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
      depthStencilAttachment: {
        view: depthTexture.createView(),

        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
      ...gpuTimingAdapter.getPassDescriptorMixin(),
    };

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

    passEncoder.setPipeline(renderPipeline);
    passEncoder.setBindGroup(0, uniformBindGroup);
    passEncoder.setBindGroup(1, lightsBindGroup);
    passEncoder.setBindGroup(2, cubeTextureBindGroup);
    passEncoder.setVertexBuffer(0, cubeVertexBuffer);
    passEncoder.setVertexBuffer(1, cubeInstanceBuffer);
    passEncoder.draw(cubeVertexCount, cubeInstances);

    passEncoder.setBindGroup(2, grassTextureBindGroup);
    passEncoder.setVertexBuffer(0, planeVertexBuffer);
    passEncoder.setVertexBuffer(1, planeInstanceBuffer);
    passEncoder.draw(planeVertexCount, planeInstances);

    passEncoder.end();
    gpuTimingAdapter.trackPassEnd(commandEncoder);

    device.queue.submit([commandEncoder.finish()]);

    let timingValues = timing.endFrame(gpuTimingAdapter.getResult());
    timingDisplay.display(timingValues);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

await main();
