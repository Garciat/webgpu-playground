import * as memory from "jsr:@garciat/wgpu-memory@1.2.6";

import { downloadText } from "../../js/utils.ts";

import {
  createGPUTimingAdapter,
  RollingAverage,
  TimingManager,
  TimingValuesDisplay,
} from "../../js/webgpu-timing.ts";

import { Screen } from "../../js/display.ts";

import { Force, Particle, RenderParams, SimulationParams } from "./types.ts";

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

  const particleCountMax = Math.floor(
    device.limits.maxStorageBufferBindingSize /
      Particle.byteSize,
  );

  const particleCount = 10_000;
  const particleData = memory.allocate(Particle, particleCount);
  {
    const view = new DataView(particleData);

    for (let i = 0; i < particleCount; ++i) {
      const x = Math.random() * canvas.width - canvas.width / 2;
      const y = Math.random() * canvas.height - canvas.height / 2;

      const a = Math.random() * 0.6 + 0.2;

      Particle.fields.position.writeAt(view, i, [x, y]);
      Particle.fields.velocity.writeAt(view, i, [0, 0]);
      Particle.fields.color.writeAt(view, i, [1 * a, 1 * a, 1 * a, a]);
    }
  }

  const forceData = memory.allocate(Force, 2);
  {
    const view = new DataView(forceData);

    Force.fields.position.writeAt(view, 0, [200, 0]);
    Force.fields.value.writeAt(view, 0, -1000);

    Force.fields.position.writeAt(view, 1, [-200, 0]);
    Force.fields.value.writeAt(view, 1, 1000);
  }

  const gpuComputeTimeKey = "gpu-compute" as const;
  const gpuRenderTimeKey = "gpu-render" as const;

  const gpuTimingAdapter = createGPUTimingAdapter(device, {
    [gpuComputeTimeKey]: {},
    [gpuRenderTimeKey]: {},
  });

  const renderModule = device.createShaderModule({
    code: await downloadText(import.meta.resolve("./render.wgsl")),
  });

  const quadVertexBuffer = device.createBuffer({
    size: 6 * 2 * 4,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  // deno-fmt-ignore
  const vertexData = [
    -1.0, -1.0, +1.0, -1.0, -1.0, +1.0, -1.0, +1.0, +1.0, -1.0, +1.0, +1.0,
  ];
  new Float32Array(quadVertexBuffer.getMappedRange()).set(vertexData);
  quadVertexBuffer.unmap();

  const LocParticle = 0;
  const LocVertex = LocParticle + 3;

  const renderPipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: renderModule,
      entryPoint: "vertex_main",
      buffers: [
        {
          stepMode: "instance",
          attributes: [
            // position
            {
              shaderLocation: LocParticle + 0,
              offset: Particle.fields.position.offset,
              format: "float32x2",
            },
            // velocity
            {
              shaderLocation: LocParticle + 1,
              offset: Particle.fields.velocity.offset,
              format: "float32x2",
            },
            // color
            {
              shaderLocation: LocParticle + 2,
              offset: Particle.fields.color.offset,
              format: "float32x4",
            },
          ],
          arrayStride: Particle.byteSize,
        },
        {
          stepMode: "vertex",
          attributes: [
            // vertex
            {
              shaderLocation: LocVertex,
              offset: 0,
              format: "float32x2",
            },
          ],
          arrayStride: 2 * 4,
        },
      ],
    },
    fragment: {
      module: renderModule,
      entryPoint: "fragment_main",
      targets: [
        {
          format: canvasTextureFormat,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one",
              operation: "add",
            },
            alpha: {
              srcFactor: "zero",
              dstFactor: "one",
              operation: "add",
            },
          },
        },
      ],
    },
    primitive: {
      topology: "triangle-list",
    },
  });

  const renderParams = {
    resolution: {
      get x() {
        return canvas.width;
      },
      get y() {
        return canvas.height;
      },
    },
    particleSizePx: 5,
  };

  const renderParamsBuffer = device.createBuffer({
    size: RenderParams.byteSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const renderUniformBindGroup = device.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: renderParamsBuffer,
        },
      },
    ],
  });

  const computePipeline = device.createComputePipeline({
    layout: "auto",
    compute: {
      module: device.createShaderModule({
        code: await downloadText(import.meta.resolve("./compute.wgsl")),
      }),
      entryPoint: "main",
    },
  });

  const simulationParams = {
    deltaTime: 1,
    friction: 0.05,
    forceCutOffRadius: 10,
    forceCount: 2,
    particleCount: particleCount,
  };

  const simulationParamsBuffer = device.createBuffer({
    size: SimulationParams.byteSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const forceBuffer = createBufferFromData(
    device,
    forceData,
    GPUBufferUsage.STORAGE,
  );

  const particleBuffers: GPUBuffer[] = new Array(2);
  const particleBindGroups: GPUBindGroup[] = new Array(2);
  for (let i = 0; i < 2; ++i) {
    particleBuffers[i] = createBufferFromData(
      device,
      particleData,
      GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
    );
  }

  for (let i = 0; i < 2; ++i) {
    particleBindGroups[i] = device.createBindGroup({
      label: `particleBindGroup${i}`,
      layout: computePipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: simulationParamsBuffer,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: forceBuffer,
            offset: 0,
            size: forceData.byteLength,
          },
        },
        {
          binding: 2,
          resource: {
            buffer: particleBuffers[i],
            offset: 0,
            size: particleData.byteLength,
          },
        },
        {
          binding: 3,
          resource: {
            buffer: particleBuffers[(i + 1) % 2],
            offset: 0,
            size: particleData.byteLength,
          },
        },
      ],
    });
  }

  const timing = new TimingManager(
    new RollingAverage(),
    new RollingAverage(),
    {
      [gpuComputeTimeKey]: new RollingAverage(),
      [gpuRenderTimeKey]: new RollingAverage(),
    },
  );

  const timingDisplay = new TimingValuesDisplay(document.body);

  const computePassDescriptor = {
    ...gpuTimingAdapter.getPassDescriptorMixin(gpuComputeTimeKey),
  };

  const renderPassColorAttachment: GPURenderPassColorAttachment = {
    clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
    loadOp: "clear" as const,
    storeOp: "store" as const,
    view: context.getCurrentTexture().createView(), // reset on each frame
  };

  const renderPassDescriptor = {
    colorAttachments: [
      renderPassColorAttachment,
    ],
    ...gpuTimingAdapter.getPassDescriptorMixin(gpuRenderTimeKey),
  };

  let frameIndex = 0;

  function frame(timestamp: DOMHighResTimeStamp) {
    timing.beginFrame(timestamp);

    const commandEncoder = device.createCommandEncoder();

    // upload data
    {
      const renderParamsData = memory.allocate(RenderParams, 1);
      {
        const view = new DataView(renderParamsData);
        RenderParams.fields.resolution.writeAt(view, 0, [
          renderParams.resolution.x,
          renderParams.resolution.y,
        ]);
        RenderParams.fields.particleSizePx.writeAt(
          view,
          0,
          renderParams.particleSizePx,
        );
      }
      device.queue.writeBuffer(
        renderParamsBuffer,
        0,
        renderParamsData,
      );

      const simulationParamsData = memory.allocate(SimulationParams, 1);
      {
        const view = new DataView(simulationParamsData);
        SimulationParams.fields.deltaTime.writeAt(
          view,
          0,
          simulationParams.deltaTime,
        );
        SimulationParams.fields.friction.writeAt(
          view,
          0,
          simulationParams.friction,
        );
        SimulationParams.fields.forceCutOffRadius.writeAt(
          view,
          0,
          simulationParams.forceCutOffRadius,
        );
        SimulationParams.fields.forceCount.writeAt(
          view,
          0,
          simulationParams.forceCount,
        );
        SimulationParams.fields.particleCount.writeAt(
          view,
          0,
          simulationParams.particleCount,
        );
      }
      device.queue.writeBuffer(
        simulationParamsBuffer,
        0,
        simulationParamsData,
      );
    }

    // compute pass
    {
      const passEncoder = commandEncoder.beginComputePass(
        computePassDescriptor,
      );
      passEncoder.setPipeline(computePipeline);
      passEncoder.setBindGroup(0, particleBindGroups[frameIndex % 2]);
      passEncoder.dispatchWorkgroups(
        Math.ceil(simulationParams.particleCount / 64),
      );
      passEncoder.end();
    }

    // render pass
    {
      renderPassColorAttachment.view = context.getCurrentTexture().createView();

      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

      passEncoder.setPipeline(renderPipeline);
      passEncoder.setBindGroup(0, renderUniformBindGroup);
      passEncoder.setVertexBuffer(0, particleBuffers[(frameIndex + 1) % 2]);
      passEncoder.setVertexBuffer(1, quadVertexBuffer);
      passEncoder.draw(6, simulationParams.particleCount, 0, 0);
      passEncoder.end();
    }

    gpuTimingAdapter.trackPassEnd(commandEncoder);
    device.queue.submit([commandEncoder.finish()]);

    const timingValues = timing.endFrame(gpuTimingAdapter.getResult());
    timingDisplay.display(timingValues);

    ++frameIndex;
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

await main();
