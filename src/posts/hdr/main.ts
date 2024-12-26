import { mat4, vec3 } from "npm:wgpu-matrix@3.3.0";

import * as memory from "jsr:@garciat/wgpu-memory@1.0.8";

import { downloadText } from "../../js/utils.ts";

import {
  createGPUTimingAdapter,
  RollingAverage,
  TimingManager,
  TimingValuesDisplay,
} from "../../js/webgpu-timing.ts";

import { Screen } from "../../js/display.ts";

import { loadImageTexture, loadImageTextureHDR } from "../../js/resources.ts";

import { CameraUniform, Instance, Light, Vertex } from "./types.ts";

import { CubeMeshData } from "./mesh-cube.ts";
import { PlaneMeshData } from "./mesh-plane.ts";
import { getBindGroupLayouts, VertexBufferLayout } from "./shaders-layout.ts";

const CubeInstanceData = memory.allocate(Instance, 2);
{
  const view = new DataView(CubeInstanceData);

  {
    // Cat
    const position = vec3.fromValues(0, 0, 0);
    const scale = vec3.fromValues(0.5, 0.5, 0.5);

    Instance.fields.tint.writeAt(view, 0, [1, 1, 1, 1]);

    const model = Instance.fields.model.viewAt(CubeInstanceData, 0);
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

const PlaneInstanceData = memory.allocate(Instance, 1);
{
  const view = new DataView(PlaneInstanceData);
  {
    // Ground
    const position = vec3.fromValues(0, -2, 0);
    const scale = vec3.fromValues(20, 20, 20);
    const rotation = vec3.fromValues(-Math.PI / 2, 0, 0);

    Instance.fields.tint.writeAt(view, 0, [1, 1, 1, 1]);

    const model = Instance.fields.model.viewAt(PlaneInstanceData, 0);
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

function createBufferFromData(
  device: GPUDevice,
  data: ArrayBuffer,
  usage: GPUBufferUsageFlags,
) {
  const buffer = device.createBuffer({
    size: data.byteLength,
    usage: usage | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}

async function main() {
  const { canvas } = Screen.setup(
    document.body,
    globalThis.devicePixelRatio,
  );

  const { device, context, canvasTextureFormat } = await Screen.gpu(
    navigator.gpu,
    canvas,
    {
      optionalFeatures: ["timestamp-query"],
    },
  );

  const gpuTimingAdapter = createGPUTimingAdapter(device);

  const cubeVertexBuffer = createBufferFromData(
    device,
    CubeMeshData,
    GPUBufferUsage.VERTEX,
  );
  const planeVertexBuffer = createBufferFromData(
    device,
    PlaneMeshData,
    GPUBufferUsage.VERTEX,
  );

  const cubeInstanceBuffer = createBufferFromData(
    device,
    CubeInstanceData,
    GPUBufferUsage.VERTEX,
  );
  const planeInstanceBuffer = createBufferFromData(
    device,
    PlaneInstanceData,
    GPUBufferUsage.VERTEX,
  );

  const lightBuffer = createBufferFromData(
    device,
    LightData,
    GPUBufferUsage.STORAGE,
  );

  const shaderModule = device.createShaderModule({
    code: await downloadText("shaders.wgsl"),
  });

  const { uniformsBindLayout, lightsBindLayout, textureBindLayout } =
    getBindGroupLayouts(device);

  const renderPipeline = device.createRenderPipeline({
    vertex: {
      module: shaderModule,
      entryPoint: "vertex_main",
      buffers: VertexBufferLayout,
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fragment_main",
      targets: [
        {
          format: canvasTextureFormat,
        },
      ],
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "back",
    },
    // Enable depth testing so that the fragment closest to the camera
    // is rendered in front.
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: "less",
      format: "depth24plus",
    },
    layout: device.createPipelineLayout({
      bindGroupLayouts: [
        uniformsBindLayout,
        lightsBindLayout,
        textureBindLayout,
      ],
    }),
  });

  const depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  // Uniforms
  const timeUniformData = memory.allocate(memory.Float32);
  const cameraUniformData = memory.allocate(CameraUniform);
  const cameraUniform = CameraUniform.viewAt(cameraUniformData, 0);

  const timeBuffer = device.createBuffer({
    size: timeUniformData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const cameraBuffer = device.createBuffer({
    size: cameraUniformData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const cubeTexture = await loadImageTextureHDR(
    device,
    "lulu.png",
    canvasTextureFormat,
  );

  const grassTexture = await loadImageTexture(
    device,
    "grass.jpg",
    canvasTextureFormat,
  );

  const sampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
  });

  const uniformBindGroup = device.createBindGroup({
    layout: uniformsBindLayout,
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
    layout: lightsBindLayout,
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
    layout: textureBindLayout,
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
    layout: textureBindLayout,
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

  mat4.perspective(
    (2 * Math.PI) / 5,
    aspect,
    1,
    100.0,
    cameraUniform.projection,
  );

  function updateCamera(time: number) {
    const view = cameraUniform.view;

    const pos = vec3.fromValues(0, 0, -5);

    mat4.identity(view);
    mat4.translate(view, pos, view);
    mat4.rotateX(view, Math.PI / 8, view);
    mat4.rotateY(view, time, view);
  }

  function updateUniforms(time: number) {
    memory.Float32.writeAt(new DataView(timeUniformData), 0, time);
  }

  function updateInstances(time: number) {
    for (let i = 0; i < memory.count(Instance, CubeInstanceData); i++) {
      const { model, mvMatrix, normalMatrix } = Instance.viewAt(
        CubeInstanceData,
        i,
      );

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

    for (let i = 0; i < memory.count(Instance, PlaneInstanceData); i++) {
      const { model, mvMatrix, normalMatrix } = Instance.viewAt(
        PlaneInstanceData,
        i,
      );

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

  function frame(timestamp: DOMHighResTimeStamp) {
    timing.beginFrame(timestamp);

    const time = timestamp / 1000;

    updateCamera(time);
    updateUniforms(time);
    updateInstances(time);

    // Update uniforms
    device.queue.writeBuffer(timeBuffer, 0, timeUniformData);
    device.queue.writeBuffer(cameraBuffer, 0, cameraUniformData);
    device.queue.writeBuffer(cubeInstanceBuffer, 0, CubeInstanceData);
    device.queue.writeBuffer(planeInstanceBuffer, 0, PlaneInstanceData);

    const commandEncoder = device.createCommandEncoder();

    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
          view: context.getCurrentTexture().createView(),
        },
      ],
      depthStencilAttachment: {
        view: depthTexture.createView(),

        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",
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
    passEncoder.draw(
      memory.count(Vertex, CubeMeshData),
      memory.count(Instance, CubeInstanceData),
    );

    passEncoder.setBindGroup(2, grassTextureBindGroup);
    passEncoder.setVertexBuffer(0, planeVertexBuffer);
    passEncoder.setVertexBuffer(1, planeInstanceBuffer);
    passEncoder.draw(
      memory.count(Vertex, PlaneMeshData),
      memory.count(Instance, PlaneInstanceData),
    );

    passEncoder.end();
    gpuTimingAdapter.trackPassEnd(commandEncoder);

    device.queue.submit([commandEncoder.finish()]);

    const timingValues = timing.endFrame(gpuTimingAdapter.getResult());
    timingDisplay.display(timingValues);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

await main();
