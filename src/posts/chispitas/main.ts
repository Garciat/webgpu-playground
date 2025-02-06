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
  const pixelRatio = globalThis.devicePixelRatio;

  const { canvas } = Screen.setup(
    document.body,
    pixelRatio,
  );

  const { device, context, canvasTextureFormat } = await Screen.gpu(
    navigator.gpu,
    canvas,
    {
      optionalFeatures: ["timestamp-query"],
    },
  );

  function screenToWorldK(k: number): number {
    return k * pixelRatio;
  }

  function screenToWorldXY([sx, sy]: [number, number]): [number, number] {
    const wx = sx * pixelRatio - canvas.width / 2;
    const wy = canvas.height / 2 - sy * pixelRatio;
    return [wx, wy];
  }

  const particleCountMax = 1_000_000;
  const particleData = memory.allocate(Particle, particleCountMax);

  const forceData = memory.allocate(Force, 2);
  {
    const view = new DataView(forceData);

    Force.fields.position.writeAt(view, 0, [screenToWorldK(200), 0]);
    Force.fields.value.writeAt(view, 0, screenToWorldK(-1000));

    Force.fields.position.writeAt(view, 1, [screenToWorldK(-200), 0]);
    Force.fields.value.writeAt(view, 1, screenToWorldK(1000));
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
  const LocVertex = LocParticle + 4;

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
            // radius
            {
              shaderLocation: LocParticle + 3,
              offset: Particle.fields.radius.offset,
              format: "float32",
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
    forceCutOffRadius: screenToWorldK(10),
    forceCount: 2,
    particleCount: 0,
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

    // generate particles on pointer down
    {
      const view = new DataView(particleData);
      const n = 20;
      let offset = 0;

      for (const pointer of pointers.values()) {
        if (pointer.isDown) {
          const color = hslaToRgba([pointer.hue * 360, 1, 0.5, 1]);
          const position = screenToWorldXY(pointer.position);

          for (let i = 0; i < n; ++i) {
            const angle = Math.random() * Math.PI * 2;
            const speed = screenToWorldK(5 + Math.random() * 5);

            const dx = Math.cos(angle) * speed;
            const dy = Math.sin(angle) * speed;

            const a = Math.random() * 0.4 + 0.4;

            Particle.fields.position.writeAt(view, offset + i, position);
            Particle.fields.velocity.writeAt(view, offset + i, [dx, dy]);
            Particle.fields.color.writeAt(view, offset + i, [
              color[0] * a,
              color[1] * a,
              color[2] * a,
              a,
            ]);
            Particle.fields.radius.writeAt(
              view,
              offset + i,
              screenToWorldK(2 + Math.random() * 4),
            );
          }

          offset += n;
        }
      }

      device.queue.writeBuffer(
        particleBuffers[frameIndex % 2],
        simulationParams.particleCount * Particle.byteSize,
        particleData,
        0,
        offset * Particle.byteSize,
      );
      simulationParams.particleCount += offset;
    }

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

  class PointerInfo {
    id = 0;
    position: [number, number] = [0, 0];
    isDown = false;
    hue = Math.random();
  }

  function newPointerFromEvent(event: PointerEvent): PointerInfo {
    const pointer = new PointerInfo();
    pointer.id = event.pointerId;
    pointer.position = [event.offsetX, event.offsetY];
    pointer.isDown = event.type === "pointerdown";
    return pointer;
  }

  const pointers = new Map<number, PointerInfo>();

  function getOrSetPointer(event: PointerEvent) {
    let pointer = pointers.get(event.pointerId);
    if (!pointer) {
      pointer = newPointerFromEvent(event);
      pointers.set(pointer.id, pointer);
    }
    return pointer;
  }

  canvas.addEventListener("pointerenter", (event) => {
    getOrSetPointer(event);
  });

  canvas.addEventListener("pointerdown", (event) => {
    const pointer = getOrSetPointer(event);
    pointer.isDown = true;
    pointer.hue = Math.random();
  });

  canvas.addEventListener("pointermove", (event) => {
    const pointer = getOrSetPointer(event);
    pointer.position = [event.offsetX, event.offsetY];
  });

  canvas.addEventListener("pointerup", (event) => {
    const pointer = getOrSetPointer(event);
    pointer.isDown = false;
  });

  canvas.addEventListener("pointercancel", (event) => {
    pointers.delete(event.pointerId);
  });

  canvas.addEventListener("pointerleave", (event) => {
    pointers.delete(event.pointerId);
  });
}

await main();

function hslaToRgba(
  [h, s, l, a]: [number, number, number, number],
): [number, number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return [r + m, g + m, b + m, a];
}
