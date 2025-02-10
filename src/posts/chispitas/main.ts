import { mat4, vec2, vec4 } from "npm:wgpu-matrix@3.3.0";
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
    camera: {
      position: vec4.fromValues(0, 0, -800, 1),
    },

    view: mat4.create(),
    viewUpdate() {
      mat4.identity(this.view);
      mat4.translate(this.view, [
        -this.camera.position[0],
        -this.camera.position[1],
        this.camera.position[2],
      ], this.view);
    },

    projection: mat4.create(),
    projectionUpdate() {
      mat4.perspective(
        Math.PI / 4,
        canvas.width / canvas.height,
        1,
        100000,
        this.projection,
      );
    },

    mvp: mat4.create(),
    mvp_inverse: mat4.create(),
    mvpUpdate() {
      this.viewUpdate();
      mat4.multiply(this.projection, this.view, this.mvp);
      mat4.invert(this.mvp, this.mvp_inverse);
    },
  };

  // initial setup
  renderParams.projectionUpdate();
  renderParams.mvpUpdate();

  {
    const listener = new ResizeObserver(() => {
      renderParams.projectionUpdate();
    });
    listener.observe(canvas);
  }

  const simulationParams = {
    deltaTime: 1,
    friction: 0.05,
    forceCutOffRadius: 10,
  };

  function screenToWorldXY([sx, sy]: [number, number]): [number, number] {
    // screen to NDC
    const [nx, ny] = [
      2 * sx / canvas.clientWidth - 1,
      1 - 2 * sy / canvas.clientHeight,
    ];
    // near-plane point
    let [xn, yn, zn, wn] = vec4.transformMat4(
      [nx, ny, 0, 1],
      renderParams.mvp_inverse,
    );
    xn /= wn;
    yn /= wn;
    zn /= wn;
    // far-plane point
    let [xf, yf, zf, wf] = vec4.transformMat4(
      [nx, ny, 1, 1],
      renderParams.mvp_inverse,
    );
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
  const particleDataView = new DataView(particleData);
  let particleCount = 0;
  let particleDataIndex = 0;
  function particleAdd(
    position: [number, number],
    velocity: [number, number],
    color: [number, number, number, number],
    radius: number,
  ) {
    // TODO: check for overflow

    ParticleStruct.fields.position.writeAt(
      particleDataView,
      particleDataIndex,
      position,
    );
    ParticleStruct.fields.velocity.writeAt(
      particleDataView,
      particleDataIndex,
      velocity,
    );
    ParticleStruct.fields.color.writeAt(
      particleDataView,
      particleDataIndex,
      color,
    );
    ParticleStruct.fields.radius.writeAt(
      particleDataView,
      particleDataIndex,
      radius,
    );

    particleDataIndex += 1;
  }
  function generateParticles(
    n: number,
    position: [number, number],
    hue: number,
  ) {
    const color = hslaToRgba([hue * 360, 1, 0.5, 1]);

    for (let i = 0; i < n; ++i) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 5 + Math.random() * 5;

      const dx = Math.cos(angle) * speed;
      const dy = Math.sin(angle) * speed;

      const alpha = Math.random() * 0.4 + 0.4;

      const radius = 2 + Math.random() * 4;

      particleAdd(position, [dx, dy], rgbaApplyAlpha(color, alpha), radius);
    }
  }
  function fillScreenWithParticles(n: number) {
    const aabb = getWorldAABB();
    const w = aabb[2] - aabb[0];
    const h = aabb[3] - aabb[1];
    const a_ref = vec2.fromValues(1, 1);

    for (let i = 0; i < n; ++i) {
      const x = aabb[0] + Math.random() * w;
      const y = aabb[1] + Math.random() * h;
      const a = vec2.angle([x, y], a_ref);
      const color = hslaToRgba([a * 180 / Math.PI, 1, 0.5, 1]);
      const alpha = Math.random() * 0.4 + 0.4;

      particleAdd([x, y], [0, 0], rgbaApplyAlpha(color, alpha), 4);
    }
  }
  function particleAddFlush(buffer: GPUBuffer) {
    device.queue.writeBuffer(
      buffer,
      particleCount * ParticleStruct.byteSize,
      particleData,
      0,
      particleDataIndex * ParticleStruct.byteSize,
    );
    particleCount += particleDataIndex;
    particleDataIndex = 0;
  }

  const forceCountMax = 100;
  const forceData = memory.allocate(ForceStruct, forceCountMax);
  const forceDataView = new DataView(forceData);
  let forceCount = 0;
  let forceDataIndex = 0;
  function forceAdd(position: [number, number], value: number) {
    if (!canAddForce(position)) {
      return;
    }

    ForceStruct.fields.position.writeAt(
      forceDataView,
      forceDataIndex,
      position,
    );
    ForceStruct.fields.value.writeAt(forceDataView, forceDataIndex, value);

    forceDataIndex = (forceDataIndex + 1) % forceCountMax;
    forceCount = Math.min(
      forceCount + 1,
      forceCountMax,
    );
  }
  function forceAddFlush(buffer: GPUBuffer) {
    device.queue.writeBuffer(
      buffer,
      0,
      forceData,
      0,
      forceCount * ForceStruct.byteSize,
    );
  }
  function canAddForce([x, y]: [number, number]) {
    if (forceCount > 0) {
      // last force position
      const [px, py] = ForceStruct.fields.position.readAt(
        forceDataView,
        forceDataIndex === 0 ? forceCountMax - 1 : forceDataIndex - 1,
      );
      const d = vec2.distance([x, y], [px, py]);
      // don't add forces if too close to last one
      if (d < 10) {
        return false;
      }
    }
    return true;
  }
  function clearForces() {
    forceCount = 0;
    forceDataIndex = 0;
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

  // initial scene
  {
    fillScreenWithParticles(10_000);

    particleAddFlush(particleBuffers[0]);

    forceAdd([-200, 0], 1000);
    forceAdd([200, 0], -1000);

    forceAddFlush(forceBuffer);
  }

  let frameIndex = 0;

  function handlePointers() {
    for (const pointer of pointers.values()) {
      if (pointer.isDown) {
        const position = screenToWorldXY(pointer.position);
        generateParticles(20, position, pointer.hue);
      }
    }
  }

  const ControllerLayouts = {
    SwitchPro: {
      B: 0,
      A: 1,
      Y: 2,
      X: 3,
      ZR: 7,
    },
  } as const;

  function handleGamepads() {
    const [cx, cy] = renderParams.camera.position;

    for (const gamepad of gamepads.values()) {
      const actual = navigator.getGamepads()[gamepad.index];
      if (actual === null) {
        continue;
      }

      // assuming Switch Pro Controller

      if (actual.buttons[ControllerLayouts.SwitchPro.B].pressed) {
        forceAdd([cx, cy], 1000);
      }
      if (actual.buttons[ControllerLayouts.SwitchPro.A].pressed) {
        forceAdd([cx, cy], -1000);
      }
      if (actual.buttons[ControllerLayouts.SwitchPro.Y].pressed) {
        fillScreenWithParticles(1_000);
      }
      if (actual.buttons[ControllerLayouts.SwitchPro.X].pressed) {
        clearForces();
      }
      if (actual.buttons[ControllerLayouts.SwitchPro.ZR].pressed) {
        generateParticles(20, [cx, cy], Math.random());
      }

      {
        const factor = -renderParams.camera.position[2] / 50;
        const [ax, ay, _bx, by] = actual.axes;
        renderParams.camera.position[0] += ax * factor;
        renderParams.camera.position[1] -= ay * factor;
        renderParams.camera.position[2] -= by * factor;
      }
    }
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
      forceCount,
    );
    SimulationParamsStruct.fields.particleCount.writeAt(
      out,
      0,
      particleCount,
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
      particleCount,
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
    const _out = new DataView(renderParamsData);

    renderParams.mvpUpdate();

    RenderParamsStruct.fields.modelViewProjectionMatrix.viewAt(
      renderParamsData,
      0,
    ).set(renderParams.mvp);

    device.queue.writeBuffer(
      renderParamsBuffer,
      0,
      renderParamsData,
    );
  }

  function frame(timestamp: DOMHighResTimeStamp) {
    timing.beginFrame(timestamp);

    handlePointers();

    handleGamepads();

    particleAddFlush(particleBuffers[frameIndex % 2]);
    forceAddFlush(forceBuffer);

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
        Math.ceil(particleCount / 64),
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
        Math.ceil(particleCount / 64),
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

    if (event.ctrlKey) { // zoom
      // current mouse position in world space
      const [wx, wy] = screenToWorldXY([event.clientX, event.clientY]);
      // direction from camera to mouse (order determines zoom in/out)
      const dir = vec4.normalize(
        vec4.subtract([wx, wy, 0, 1], renderParams.camera.position),
      );
      // zoom factor
      const factor = renderParams.camera.position[2] / 100;
      const length = event.deltaY * factor;
      // move camera in direction of mouse
      vec4.addScaled(
        renderParams.camera.position,
        dir,
        length,
        renderParams.camera.position,
      );
    } else { // pan
      const factor = renderParams.camera.position[2] / 500;
      renderParams.camera.position[0] -= event.deltaX * factor;
      renderParams.camera.position[1] += event.deltaY * factor;
    }
  });

  const gamepads = new Map<number, Gamepad>();

  globalThis.addEventListener("gamepadconnected", (event) => {
    console.log(
      "Gamepad connected at index %d: %s. %d buttons, %d axes.",
      event.gamepad.index,
      event.gamepad.id,
      event.gamepad.buttons.length,
      event.gamepad.axes.length,
    );
    gamepads.set(event.gamepad.index, event.gamepad);
  });

  globalThis.addEventListener("gamepaddisconnected", (event) => {
    console.log("Gamepad disconnected from index %d: %s", event.gamepad.index);
    gamepads.delete(event.gamepad.index);
  });
}

await main();

function rgbaApplyAlpha(
  [r, g, b, a]: [number, number, number, number],
  alpha: number,
): [number, number, number, number] {
  return [r * alpha, g * alpha, b * alpha, a * alpha];
}

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
