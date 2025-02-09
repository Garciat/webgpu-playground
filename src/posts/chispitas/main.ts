import { mat4, vec4 } from "npm:wgpu-matrix@3.3.0";
import * as memory from "jsr:@garciat/wgpu-memory@1.2.6";

import { downloadText } from "../../js/utils.ts";

import {
  createGPUTimingAdapter,
  RollingAverage,
  TimingManager,
  TimingValuesDisplay,
} from "../../js/webgpu-timing.ts";

import { Screen } from "../../js/display.ts";

import {
  CullParamsStruct,
  ForceStruct,
  ParticleStruct,
  RenderParamsStruct,
  SimulationParamsStruct,
} from "./types.ts";

async function main() {
  const pixelRatio = globalThis.devicePixelRatio;

  const { canvas } = Screen.setup(
    document.body,
    pixelRatio,
  );

  const { device, context } = await Screen.gpu(
    navigator.gpu,
    canvas,
    {
      optionalFeatures: ["timestamp-query"],
    },
  );

  const renderParams = {
    camera: vec4.fromValues(0, 0, -800, 1),

    _view: mat4.create(),
    get view() {
      mat4.identity(this._view);
      mat4.translate(this._view, [
        -this.camera[0],
        -this.camera[1],
        this.camera[2],
      ], this._view);
      return this._view;
    },

    _projection: mat4.create(),
    get projection() {
      mat4.perspective(
        Math.PI / 4,
        canvas.width / canvas.height,
        1,
        100000,
        this._projection,
      );
      return this._projection;
    },

    mvp: mat4.create(),
  };

  const simulationParams = {
    deltaTime: 1,
    friction: 0.05,
    forceCutOffRadius: 10,
    forceCount: 2,
    particleCount: 0,
  };

  function screenToWorldXY([sx, sy]: [number, number]): [number, number] {
    // screen to NDC
    const [nx, ny] = [
      2 * sx / canvas.clientWidth - 1,
      1 - 2 * sy / canvas.clientHeight,
    ];
    const m = mat4.inverse(
      mat4.multiply(renderParams.projection, renderParams.view),
    );
    // near-plane point
    let [xn, yn, zn, wn] = vec4.transformMat4([nx, ny, 0, 1], m);
    xn /= wn;
    yn /= wn;
    zn /= wn;
    // far-plane point
    let [xf, yf, zf, wf] = vec4.transformMat4([nx, ny, 1, 1], m);
    xf /= wf;
    yf /= wf;
    zf /= wf;
    // return intersection with z = 0 plane
    const t = -zn / (zf - zn);
    return [xn + t * (xf - xn), yn + t * (yf - yn)];
  }

  // TODO: optimize
  function getWorldAABB(): [number, number, number, number] {
    // bottom left
    const a = screenToWorldXY([0, canvas.clientHeight]);
    // top right
    const b = screenToWorldXY([canvas.clientWidth, 0]);
    return [a[0], a[1], b[0], b[1]];
  }

  const particleCountMax = 1_000_000;
  const particleData = memory.allocate(ParticleStruct, particleCountMax);
  {
    const n = 10_000;
    const aabb = getWorldAABB();
    const view = new DataView(particleData);
    for (let i = 0; i < n; ++i) {
      const x = aabb[0] + Math.random() * (aabb[2] - aabb[0]);
      const y = aabb[1] + Math.random() * (aabb[3] - aabb[1]);
      ParticleStruct.fields.position.writeAt(view, i, [x, y]);
      ParticleStruct.fields.velocity.writeAt(view, i, [0, 0]);
      ParticleStruct.fields.color.writeAt(view, i, [0.5, 0.5, 0, 0.5]);
      ParticleStruct.fields.radius.writeAt(view, i, 4);
    }
    simulationParams.particleCount = n;
  }

  const forceData = memory.allocate(ForceStruct, 2);
  {
    const view = new DataView(forceData);

    ForceStruct.fields.position.writeAt(view, 0, [200, 0]);
    ForceStruct.fields.value.writeAt(view, 0, -1000);

    ForceStruct.fields.position.writeAt(view, 1, [-200, 0]);
    ForceStruct.fields.value.writeAt(view, 1, 1000);
  }

  const gpuSimTimeKey = "gpu-sim" as const;
  const gpuCullTimeKey = "gpu-cull" as const;
  const gpuRenderTimeKey = "gpu-render" as const;

  const gpuTimingAdapter = createGPUTimingAdapter(device, {
    [gpuSimTimeKey]: {},
    [gpuCullTimeKey]: {},
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
    label: "renderPipeline",
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
              offset: ParticleStruct.fields.position.offset,
              format: "float32x2",
            },
            // velocity
            {
              shaderLocation: LocParticle + 1,
              offset: ParticleStruct.fields.velocity.offset,
              format: "float32x2",
            },
            // color
            {
              shaderLocation: LocParticle + 2,
              offset: ParticleStruct.fields.color.offset,
              format: "float32x4",
            },
            // radius
            {
              shaderLocation: LocParticle + 3,
              offset: ParticleStruct.fields.radius.offset,
              format: "float32",
            },
          ],
          arrayStride: ParticleStruct.byteSize,
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
          format: context.getCurrentTexture().format,
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

  const renderParamsBuffer = device.createBuffer({
    label: "renderParamsBuffer",
    size: RenderParamsStruct.byteSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const renderUniformBindGroup = device.createBindGroup({
    label: "renderUniformBindGroup",
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

  const simulationComputePipeline = device.createComputePipeline({
    label: "simulationComputePipeline",
    layout: "auto",
    compute: {
      module: device.createShaderModule({
        code: await downloadText(import.meta.resolve("./sim.compute.wgsl")),
      }),
      entryPoint: "main",
    },
  });

  const simulationParamsBuffer = device.createBuffer({
    label: "simulationParamsBuffer",
    size: SimulationParamsStruct.byteSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const forceBuffer = device.createBuffer({
    label: "forceBuffer",
    size: forceData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(forceBuffer, 0, forceData);

  const particleBuffers: GPUBuffer[] = new Array(2);
  for (let i = 0; i < 2; ++i) {
    particleBuffers[i] = device.createBuffer({
      label: `particleBuffer[${i}]`,
      size: particleData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(particleBuffers[i], 0, particleData);
  }

  const simulationBindGroupFixed = device.createBindGroup({
    label: "simulationBindGroupFixed",
    layout: simulationComputePipeline.getBindGroupLayout(0),
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
        },
      },
    ],
  });

  const simulationBindGroupPingPong = new Array<GPUBindGroup>(2);
  for (let i = 0; i < 2; ++i) {
    simulationBindGroupPingPong[i] = device.createBindGroup({
      label: `simulationBindGroupPingPong[${i}]`,
      layout: simulationComputePipeline.getBindGroupLayout(1),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: particleBuffers[i],
            offset: 0,
            size: particleData.byteLength,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: particleBuffers[(i + 1) % 2],
            offset: 0,
            size: particleData.byteLength,
          },
        },
      ],
    });
  }

  const cullComputePipeline = device.createComputePipeline({
    label: "cullComputePipeline",
    layout: "auto",
    compute: {
      module: device.createShaderModule({
        code: await downloadText(import.meta.resolve("./cull.compute.wgsl")),
      }),
      entryPoint: "main",
    },
  });

  const cullParamsBuffer = device.createBuffer({
    label: "cullParamsBuffer",
    size: CullParamsStruct.byteSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const visibleParticlesBuffer = device.createBuffer({
    label: "visibleParticlesBuffer",
    size: ParticleStruct.byteSize * particleCountMax,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX,
  });

  const drawIndirectBuffer = device.createBuffer({
    label: "drawIndirectBuffer",
    size: 4 * 4,
    usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_DST,
  });

  const cullBindGroupFixed = device.createBindGroup({
    label: "cullBindGroupFixed",
    layout: cullComputePipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: cullParamsBuffer,
        },
      },
      {
        binding: 1,
        resource: {
          buffer: visibleParticlesBuffer,
        },
      },
      {
        binding: 2,
        resource: {
          buffer: drawIndirectBuffer,
        },
      },
    ],
  });

  const cullBindGroupPingPong = new Array<GPUBindGroup>(2);
  for (let i = 0; i < 2; ++i) {
    cullBindGroupPingPong[i] = device.createBindGroup({
      label: `cullBindGroupPingPong[${i}]`,
      layout: cullComputePipeline.getBindGroupLayout(1),
      entries: [
        {
          binding: 0,
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
      [gpuSimTimeKey]: new RollingAverage(),
      [gpuCullTimeKey]: new RollingAverage(),
      [gpuRenderTimeKey]: new RollingAverage(),
    },
  );

  const timingDisplay = new TimingValuesDisplay(document.body);

  const simulationComputePassDescriptor = {
    label: "simulationComputePass",
    ...gpuTimingAdapter.getPassDescriptorMixin(gpuSimTimeKey),
  };

  const cullComputePassDescriptor = {
    lable: "cullComputePass",
    ...gpuTimingAdapter.getPassDescriptorMixin(gpuCullTimeKey),
  };

  const renderPassColorAttachment: GPURenderPassColorAttachment = {
    clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
    loadOp: "clear" as const,
    storeOp: "store" as const,
    view: context.getCurrentTexture().createView(), // reset on each frame
  };

  const renderPassDescriptor = {
    label: "renderPass",
    colorAttachments: [
      renderPassColorAttachment,
    ],
    ...gpuTimingAdapter.getPassDescriptorMixin(gpuRenderTimeKey),
  };

  const renderParamsData = memory.allocate(RenderParamsStruct, 1);
  const simulationParamsData = memory.allocate(SimulationParamsStruct, 1);
  const cullParamsData = memory.allocate(CullParamsStruct, 1);
  const drawIndirectData = new Uint32Array([6, 0, 0, 0]);

  let frameIndex = 0;

  function generateParticles() {
    const view = new DataView(particleData);
    const n = 20;
    let offset = 0;

    for (const pointer of pointers.values()) {
      if (pointer.isDown) {
        const color = hslaToRgba([pointer.hue * 360, 1, 0.5, 1]);
        const position = screenToWorldXY(pointer.position);

        for (let i = 0; i < n; ++i) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 5 + Math.random() * 5;

          const dx = Math.cos(angle) * speed;
          const dy = Math.sin(angle) * speed;

          const a = Math.random() * 0.4 + 0.4;

          ParticleStruct.fields.position.writeAt(view, offset + i, position);
          ParticleStruct.fields.velocity.writeAt(view, offset + i, [dx, dy]);
          ParticleStruct.fields.color.writeAt(view, offset + i, [
            color[0] * a,
            color[1] * a,
            color[2] * a,
            a,
          ]);
          ParticleStruct.fields.radius.writeAt(
            view,
            offset + i,
            2 + Math.random() * 4,
          );
        }

        offset += n;
      }
    }

    device.queue.writeBuffer(
      particleBuffers[frameIndex % 2],
      simulationParams.particleCount * ParticleStruct.byteSize,
      particleData,
      0,
      offset * ParticleStruct.byteSize,
    );
    simulationParams.particleCount += offset;
  }

  function updateSimulationParams() {
    const out = new DataView(simulationParamsData);

    SimulationParamsStruct.fields.deltaTime.writeAt(
      out,
      0,
      simulationParams.deltaTime,
    );
    SimulationParamsStruct.fields.friction.writeAt(
      out,
      0,
      simulationParams.friction,
    );
    SimulationParamsStruct.fields.forceCutOffRadius.writeAt(
      out,
      0,
      simulationParams.forceCutOffRadius,
    );
    SimulationParamsStruct.fields.forceCount.writeAt(
      out,
      0,
      simulationParams.forceCount,
    );
    SimulationParamsStruct.fields.particleCount.writeAt(
      out,
      0,
      simulationParams.particleCount,
    );

    device.queue.writeBuffer(
      simulationParamsBuffer,
      0,
      simulationParamsData,
    );
  }

  function updateCullParams() {
    const out = new DataView(cullParamsData);

    CullParamsStruct.fields.particleCount.writeAt(
      out,
      0,
      simulationParams.particleCount,
    );
    CullParamsStruct.fields.aabb.writeAt(out, 0, getWorldAABB());

    device.queue.writeBuffer(
      cullParamsBuffer,
      0,
      cullParamsData,
    );

    // reset draw indirect buffer
    device.queue.writeBuffer(
      drawIndirectBuffer,
      0,
      drawIndirectData,
    );
  }

  function updateRenderParams() {
    const out = new DataView(renderParamsData);

    const view = renderParams.view;
    const projection = renderParams.projection;
    const mvp = renderParams.mvp;

    mat4.identity(mvp);
    mat4.multiply(projection, view, mvp);
    RenderParamsStruct.fields.modelViewProjectionMatrix.viewAt(
      renderParamsData,
      0,
    ).set(mvp);

    RenderParamsStruct.fields.right.writeAt(out, 0, [
      view[0],
      view[4],
      view[8],
    ]);
    RenderParamsStruct.fields.up.writeAt(out, 0, [
      view[1],
      view[5],
      view[9],
    ]);

    device.queue.writeBuffer(
      renderParamsBuffer,
      0,
      renderParamsData,
    );
  }

  function frame(timestamp: DOMHighResTimeStamp) {
    timing.beginFrame(timestamp);

    generateParticles();

    const commandEncoder = device.createCommandEncoder({
      label: "frame",
    });

    updateSimulationParams();

    // compute pass: simulation
    {
      const passEncoder = commandEncoder.beginComputePass(
        simulationComputePassDescriptor,
      );
      passEncoder.setPipeline(simulationComputePipeline);
      passEncoder.setBindGroup(0, simulationBindGroupFixed);
      passEncoder.setBindGroup(1, simulationBindGroupPingPong[frameIndex % 2]);
      passEncoder.dispatchWorkgroups(
        Math.ceil(simulationParams.particleCount / 64),
      );
      passEncoder.end();
    }

    updateCullParams();

    // compute pass: cull
    {
      const passEncoder = commandEncoder.beginComputePass(
        cullComputePassDescriptor,
      );
      passEncoder.setPipeline(cullComputePipeline);
      passEncoder.setBindGroup(0, cullBindGroupFixed);
      passEncoder.setBindGroup(1, cullBindGroupPingPong[frameIndex % 2]);
      passEncoder.dispatchWorkgroups(
        Math.ceil(simulationParams.particleCount / 64),
      );
      passEncoder.end();
    }

    updateRenderParams();

    // render pass
    {
      renderPassColorAttachment.view = context.getCurrentTexture().createView();

      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

      passEncoder.setPipeline(renderPipeline);
      passEncoder.setBindGroup(0, renderUniformBindGroup);
      passEncoder.setVertexBuffer(0, visibleParticlesBuffer);
      passEncoder.setVertexBuffer(1, quadVertexBuffer);
      passEncoder.drawIndirect(drawIndirectBuffer, 0);
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

  canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();

    if (event.ctrlKey) {
      const [wx, wy] = screenToWorldXY([event.clientX, event.clientY]);
      const dir = vec4.normalize(
        vec4.subtract(renderParams.camera, [wx, wy, 0, 1]),
      );
      vec4.addScaled(
        renderParams.camera,
        dir,
        event.deltaY * (-renderParams.camera[2] / 100),
        renderParams.camera,
      );
    } else {
      renderParams.camera[0] -= event.deltaX * (renderParams.camera[2] / 500);
      renderParams.camera[1] += event.deltaY * (renderParams.camera[2] / 500);
    }
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
