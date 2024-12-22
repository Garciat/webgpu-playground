import {
  vec3,
  vec4,
  mat4,
} from 'https://wgpu-matrix.org/dist/3.x/wgpu-matrix.module.js';

import { download } from '../common/utils.js';

import {
  RollingAverage,
  TimingManager,
  TimingValuesDisplay,
  createGPUTimingAdapter,
} from '../common/webgpu-timing.js';

import { Screen } from '../common/display.js';

import * as memory from '../common/memory.js';

const Vertex = new memory.Struct({
  position: { index: 0, type: memory.Vec4F },
  color: { index: 1, type: memory.Vec4F },
  normal: { index: 2, type: memory.Vec3F },
  uv: { index: 3, type: memory.Vec2F },
});

const Instance = new memory.Struct({
  tint: { index: 0, type: memory.Vec4F },
  model: { index: 1, type: memory.Mat4x4F },
  mvMatrix: { index: 2, type: memory.Mat4x4F },
  normalMatrix: { index: 3, type: memory.Mat4x4F },
});

const Light = new memory.Struct({
  position: { index: 0, type: memory.Vec4F },
  color: { index: 1, type: memory.Vec4F },
});

const VertexQuad = new memory.ArrayType(Vertex, 6);

const CubeMesh = new memory.ArrayType(VertexQuad, 6);

const PlaneDivisions = 10;

const PlaneMesh = new memory.ArrayType(VertexQuad, PlaneDivisions * PlaneDivisions);

const CameraUniform = new memory.Struct({
  projection: { index: 0, type: memory.Mat4x4F },
  view: { index: 1, type: memory.Mat4x4F },
});

const CubeMeshData = memory.allocate(CubeMesh);
{
  const view = new DataView(CubeMeshData);
  CubeMesh.write(view, [
    // Front face
    [
      { position: [-1, -1, 1, 1], color: [1, 0, 0, 1], normal: [0, 0, 1], uv: [0, 0] },
      { position: [1, -1, 1, 1], color: [0, 1, 0, 1], normal: [0, 0, 1], uv: [1, 0] },
      { position: [1, 1, 1, 1], color: [0, 0, 1, 1], normal: [0, 0, 1], uv: [1, 1] },
      { position: [-1, 1, 1, 1], color: [1, 1, 1, 1], normal: [0, 0, 1], uv: [0, 1] },
      { position: [-1, -1, 1, 1], color: [1, 0, 0, 1], normal: [0, 0, 1], uv: [0, 0] },
      { position: [1, 1, 1, 1], color: [0, 0, 1, 1], normal: [0, 0, 1], uv: [1, 1] },
    ],
    // Back face
    [
      { position: [-1, -1, -1, 1], color: [1, 0, 0, 1], normal: [0, 0, -1], uv: [0, 0] },
      { position: [-1, 1, -1, 1], color: [0, 1, 0, 1], normal: [0, 0, -1], uv: [0, 1] },
      { position: [1, 1, -1, 1], color: [0, 0, 1, 1], normal: [0, 0, -1], uv: [1, 1] },
      { position: [1, -1, -1, 1], color: [1, 1, 1, 1], normal: [0, 0, -1], uv: [1, 0] },
      { position: [-1, -1, -1, 1], color: [1, 0, 0, 1], normal: [0, 0, -1], uv: [0, 0] },
      { position: [1, 1, -1, 1], color: [0, 0, 1, 1], normal: [0, 0, -1], uv: [1, 1] },
    ],
    // Top face
    [
      { position: [-1, 1, -1, 1], color: [1, 0, 0, 1], normal: [0, 1, 0], uv: [0, 0] },
      { position: [1, 1, -1, 1], color: [0, 1, 0, 1], normal: [0, 1, 0], uv: [1, 0] },
      { position: [1, 1, 1, 1], color: [0, 0, 1, 1], normal: [0, 1, 0], uv: [1, 1] },
      { position: [-1, 1, 1, 1], color: [1, 1, 1, 1], normal: [0, 1, 0], uv: [0, 1] },
      { position: [-1, 1, -1, 1], color: [1, 0, 0, 1], normal: [0, 1, 0], uv: [0, 0] },
      { position: [1, 1, 1, 1], color: [0, 0, 1, 1], normal: [0, 1, 0], uv: [1, 1] },
    ],
    // Bottom face
    [
      { position: [-1, -1, -1, 1], color: [1, 0, 0, 1], normal: [0, -1, 0], uv: [0, 0] },
      { position: [1, -1, -1, 1], color: [0, 1, 0, 1], normal: [0, -1, 0], uv: [1, 0] },
      { position: [1, -1, 1, 1], color: [0, 0, 1, 1], normal: [0, -1, 0], uv: [1, 1] },
      { position: [-1, -1, 1, 1], color: [1, 1, 1, 1], normal: [0, -1, 0], uv: [0, 1] },
      { position: [-1, -1, -1, 1], color: [1, 0, 0, 1], normal: [0, -1, 0], uv: [0, 0] },
      { position: [1, -1, 1, 1], color: [0, 0, 1, 1], normal: [0, -1, 0], uv: [1, 1] },
    ],
    // Right face
    [
      { position: [1, -1, -1, 1], color: [1, 0, 0, 1], normal: [1, 0, 0], uv: [0, 0] },
      { position: [1, 1, -1, 1], color: [0, 1, 0, 1], normal: [1, 0, 0], uv: [1, 0] },
      { position: [1, 1, 1, 1], color: [0, 0, 1, 1], normal: [1, 0, 0], uv: [1, 1] },
      { position: [1, -1, 1, 1], color: [1, 1, 1, 1], normal: [1, 0, 0], uv: [0, 1] },
      { position: [1, -1, -1, 1], color: [1, 0, 0, 1], normal: [1, 0, 0], uv: [0, 0] },
      { position: [1, 1, 1, 1], color: [0, 0, 1, 1], normal: [1, 0, 0], uv: [1, 1] },
    ],
    // Left face
    [
      { position: [-1, -1, -1, 1], color: [1, 0, 0, 1], normal: [-1, 0, 0], uv: [0, 0] },
      { position: [-1, -1, 1, 1], color: [0, 1, 0, 1], normal: [-1, 0, 0], uv: [1, 0] },
      { position: [-1, 1, 1, 1], color: [0, 0, 1, 1], normal: [-1, 0, 0], uv: [1, 1] },
      { position: [-1, 1, -1, 1], color: [1, 1, 1, 1], normal: [-1, 0, 0], uv: [0, 1] },
      { position: [-1, -1, -1, 1], color: [1, 0, 0, 1], normal: [-1, 0, 0], uv: [0, 0] },
      { position: [-1, 1, 1, 1], color: [0, 0, 1, 1], normal: [-1, 0, 0], uv: [1, 1] },
    ],
  ]);
}

const CubeInstanceData = memory.allocate(Instance, 2);
{
  const view = new DataView(CubeInstanceData);

  {
    // Cat
    const position = vec3.fromValues(0, 0, 0);
    const scale = vec3.fromValues(0.5, 0.5, 0.5);

    Instance.fields.tint.writeAt(view, 0, [1, 1, 1, 1]);

    const model = Instance.fields.model.view(CubeInstanceData, 0);
    mat4.identity(model);
    mat4.translate(model, position, model);
    mat4.scale(model, scale, model);
  }

  {
    // Light
    const position = vec3.fromValues(0, 0, -3);
    const scale = vec3.fromValues(0.05, 0.05, 0.05);

    Instance.fields.tint.writeAt(view, 1, [1, 1, 1, 1]);

    const model = Instance.fields.model.viewAt(CubeInstanceData, 1);
    mat4.identity(model);
    mat4.translate(model, position, model);
    mat4.scale(model, scale, model);
  }
}

const PlaneMeshData = memory.allocate(PlaneMesh);
{
  const view = new DataView(PlaneMeshData);
  let i = 0;
  for (let x = 0; x < PlaneDivisions; x++) {
    for (let y = 0; y < PlaneDivisions; y++) {
      const x0 = x / PlaneDivisions - 0.5;
      const x1 = (x + 1) / PlaneDivisions - 0.5;
      const y0 = y / PlaneDivisions - 0.5;
      const y1 = (y + 1) / PlaneDivisions - 0.5;

      PlaneMesh.set(view, i++, [
        { position: [x0, y0, 0, 1], color: [1, 1, 1, 1], normal: [0, 0, 1], uv: [0, 0] },
        { position: [x1, y0, 0, 1], color: [1, 1, 1, 1], normal: [0, 0, 1], uv: [1, 0] },
        { position: [x1, y1, 0, 1], color: [1, 1, 1, 1], normal: [0, 0, 1], uv: [1, 1] },
        { position: [x0, y1, 0, 1], color: [1, 1, 1, 1], normal: [0, 0, 1], uv: [0, 1] },
        { position: [x0, y0, 0, 1], color: [1, 1, 1, 1], normal: [0, 0, 1], uv: [0, 0] },
        { position: [x1, y1, 0, 1], color: [1, 1, 1, 1], normal: [0, 0, 1], uv: [1, 1] },
      ]);
    }
  }
}

const PlaneInstanceData = memory.allocate(Instance, 1);
{
  const view = new DataView(PlaneInstanceData);
  {
    // Ground
    const position = vec3.fromValues(0, -2, 0);
    const scale = vec3.fromValues(20, 20, 20);
    const rotation = vec3.fromValues(-Math.PI / 2, 0, 0);

    Instance.fields.tint.writeAt(view, 0, [1, 1, 1, 1]);

    const model = Instance.fields.model.view(PlaneInstanceData, 0);
    mat4.identity(model);
    mat4.translate(model, position, model);
    mat4.scale(model, scale, model);
    mat4.rotateX(model, rotation[0], model);
    mat4.rotateY(model, rotation[1], model);
    mat4.rotateZ(model, rotation[2], model);
  }
}

const LightData = memory.allocate(Light, 1);
{
  const view = new DataView(LightData);

  Light.writeAt(view, 0, {
    position: [0, 0, -3, 1],
    color: [10, 10, 10, 1],
  });
}

async function main() {
  const { canvas, displayW, displayH } = Screen.setup(document.body, window.devicePixelRatio);

  const { adapter, device, context, canvasTextureFormat } = await Screen.gpu(navigator.gpu, canvas, {
    optionalFeatures: ['timestamp-query'],
  });

  const gpuTimingAdapter = createGPUTimingAdapter(device);

  const cubeVertexBuffer = device.createBuffer({
    size: CubeMeshData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(cubeVertexBuffer, 0, CubeMeshData);

  const cubeInstanceBuffer = device.createBuffer({
    size: CubeInstanceData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(cubeInstanceBuffer, 0, CubeInstanceData);

  const planeVertexBuffer = device.createBuffer({
    size: PlaneMeshData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(planeVertexBuffer, 0, PlaneMeshData);

  const planeInstanceBuffer = device.createBuffer({
    size: PlaneInstanceData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(planeInstanceBuffer, 0, PlaneInstanceData);

  const lightBuffer = device.createBuffer({
    size: LightData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(lightBuffer, 0, LightData);

  const LocVertex = 0;
  const LocInstance = 4;

  /**
   * @type {GPUVertexBufferLayout[]}
   */
  const vertexBufferLayout = [
    {
      attributes: [
        {
          shaderLocation: LocVertex + 0, // position
          offset: Vertex.fields.position.offset,
          format: 'float32x4'
        },
        {
          shaderLocation: LocVertex + 1, // color
          offset: Vertex.fields.color.offset,
          format: 'float32x4'
        },
        {
          shaderLocation: LocVertex + 2, // normal
          offset: Vertex.fields.normal.offset,
          format: 'float32x3'
        },
        {
          shaderLocation: LocVertex + 3, // uv
          offset: Vertex.fields.uv.offset,
          format: 'float32x2'
        },
      ],
      arrayStride: Vertex.byteSize,
      stepMode: 'vertex'
    },
    {
      attributes: [
        {
          shaderLocation: LocInstance + 0, // tint
          offset: Instance.fields.tint.offset,
          format: 'float32x4',
        },
        {
          shaderLocation: LocInstance + 1, // mvMatrix0
          offset: Instance.fields.mvMatrix.offset + memory.Vec4F.byteSize * 0,
          format: 'float32x4',
        },
        {
          shaderLocation: LocInstance + 2, // mvMatrix1
          offset: Instance.fields.mvMatrix.offset + memory.Vec4F.byteSize * 1,
          format: 'float32x4',
        },
        {
          shaderLocation: LocInstance + 3, // mvMatrix2
          offset: Instance.fields.mvMatrix.offset + memory.Vec4F.byteSize * 2,
          format: 'float32x4',
        },
        {
          shaderLocation: LocInstance + 4, // mvMatrix3
          offset: Instance.fields.mvMatrix.offset + memory.Vec4F.byteSize * 3,
          format: 'float32x4',
        },
        {
          shaderLocation: LocInstance + 5, // normalMatrix0
          offset: Instance.fields.normalMatrix.offset + memory.Vec4F.byteSize * 0,
          format: 'float32x4',
        },
        {
          shaderLocation: LocInstance + 6, // normalMatrix1
          offset: Instance.fields.normalMatrix.offset + memory.Vec4F.byteSize * 1,
          format: 'float32x4',
        },
        {
          shaderLocation: LocInstance + 7, // normalMatrix2
          offset: Instance.fields.normalMatrix.offset + memory.Vec4F.byteSize * 2,
          format: 'float32x4',
        },
        {
          shaderLocation: LocInstance + 8, // normalMatrix3
          offset: Instance.fields.normalMatrix.offset + memory.Vec4F.byteSize * 3,
          format: 'float32x4',
        },
      ],
      arrayStride: Instance.byteSize,
      stepMode: 'instance'
    },
  ];

  const shaders = await download('shaders.wgsl', 'text');

  const shaderModule = device.createShaderModule({
    code: shaders
  });

  /**
   * @type {GPURenderPipelineDescriptor}
   */
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
  const timeUniformData = memory.allocate(memory.Float32);
  const cameraUniformData = memory.allocate(CameraUniform);
  const cameraUniform = CameraUniform.viewObject(cameraUniformData);

  const timeBuffer = device.createBuffer({
    size: timeUniformData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const cameraBuffer = device.createBuffer({
    size: cameraUniformData.byteLength,
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

  mat4.perspective((2 * Math.PI) / 5, aspect, 1, 100.0, cameraUniform.projection);

  /**
   * @param {number} time
   */
  function updateCamera(time) {
    const view = cameraUniform.view;

    const pos = vec3.fromValues(0, 0, -5);

    mat4.identity(view);
    mat4.translate(view, pos, view);
    mat4.rotateX(view, Math.PI / 8, view);
    mat4.rotateY(view, time, view);
  }

  /**
   * @param {number} time
   */
  function updateUniforms(time) {
    memory.Float32.writeAt(new DataView(timeUniformData), 0, time);
  }

  /**
   * @param {number} time
   */
  function updateInstances(time) {
    for (let i = 0; i < Instance.count(CubeInstanceData); i++) {
      const { tint, model, mvMatrix, normalMatrix } = Instance.viewObjectAt(CubeInstanceData, i);

      mat4.identity(mvMatrix);
      mat4.multiply(mvMatrix, cameraUniform.view, mvMatrix);
      mat4.multiply(mvMatrix, model, mvMatrix);

      if (i === 0) {
        mat4.rotateY(mvMatrix, time, mvMatrix);
        mat4.rotateX(mvMatrix, time, mvMatrix);
      }

      mat4.invert(mvMatrix, normalMatrix);
      mat4.transpose(normalMatrix, normalMatrix);
    }

    for (let i = 0; i < Instance.count(PlaneInstanceData); i++) {
      const { tint, model, mvMatrix, normalMatrix } = Instance.viewObjectAt(PlaneInstanceData, i);

      mat4.identity(mvMatrix);
      mat4.multiply(mvMatrix, cameraUniform.view, mvMatrix);
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

  /**
   * @param {DOMHighResTimeStamp} timestamp
   */
  function frame(timestamp) {
    timing.beginFrame(timestamp);

    const time = timestamp / 1000;

    updateCamera(time);
    updateUniforms(time);
    updateInstances(time);

    // Update uniforms
    device.queue.writeBuffer(timeBuffer, 0, timeUniformData);
    device.queue.writeBuffer(cameraBuffer, 0, cameraUniformData);
    device.queue.writeBuffer(lightBuffer, 0, LightData);
    device.queue.writeBuffer(cubeInstanceBuffer, 0, CubeInstanceData);
    device.queue.writeBuffer(planeInstanceBuffer, 0, PlaneInstanceData);

    const commandEncoder = device.createCommandEncoder();

    /**
     * @type {GPURenderPassDescriptor}
     */
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
    passEncoder.draw(Vertex.count(CubeMeshData), Instance.count(CubeInstanceData));

    passEncoder.setBindGroup(2, grassTextureBindGroup);
    passEncoder.setVertexBuffer(0, planeVertexBuffer);
    passEncoder.setVertexBuffer(1, planeInstanceBuffer);
    passEncoder.draw(Vertex.count(PlaneMeshData), Instance.count(PlaneInstanceData));

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
