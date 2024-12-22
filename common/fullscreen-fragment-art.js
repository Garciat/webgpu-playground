/// <reference path="../vendored/webgpu-types.d.ts" />

import * as memory from './memory.js';

const StaticQuadVertWGSL = `
@vertex
fn main(@builtin(vertex_index) index : u32) -> @builtin(position) vec4f {
  const pos = array(
    vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0),
    vec2(-1.0, 1.0), vec2(1.0, -1.0), vec2(1.0, 1.0),
  );
  return vec4f(pos[index], 0.0, 1.0);
}
`;

const Uniforms = new memory.Struct({
  time: {index: 0, type: memory.Vec4F},
  resolution: {index: 1, type: memory.Vec4F},
  mouse: {index: 2, type: memory.Vec4F},
});

export class FullscreenFragmentArt {
  /**
   * @type {HTMLCanvasElement}
   */
  #canvas;
  /**
   * @type {GPUDevice}
   */
  #device;
  /**
   * @type {import('./webgpu-timing.js').GPUTiming}
   */
  #gpuTiming;

  /**
   * @type {number}
   */
  #pixelRatio;

  /**
   * @type {GPURenderPipeline}
   */
  #pipeline;

  /**
   * @type {GPUBuffer}
   */
  #uniformsBuffer;
  /**
   * @type {GPUBindGroup}
   */
  #uniformsBindGroup;
  /**
   * @type {ArrayBuffer}
   */
  #uniformsData;

  /**
   * @param {{
   *  canvas: HTMLCanvasElement,
   *  device: GPUDevice,
   *  canvasTextureFormat: GPUTextureFormat,
   *  fragmentCode: string,
   *  gpuTiming: import('./webgpu-timing.js').GPUTiming,
   * }} _
   */
  constructor({
    canvas,
    device,
    canvasTextureFormat,
    fragmentCode,
    gpuTiming,
  }) {
    this.#canvas = canvas;
    this.#device = device;
    this.#gpuTiming = gpuTiming;

    this.#pixelRatio = canvas.width / canvas.clientWidth;

    this.#pipeline = device.createRenderPipeline({
      vertex: {
        module: device.createShaderModule({
          code: StaticQuadVertWGSL,
        }),
      },
      fragment: {
        module: device.createShaderModule({
          code: fragmentCode,
        }),
        targets: [
          {
            format: canvasTextureFormat,
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
      },
      layout: 'auto',
    });

    this.#uniformsData = memory.allocate(Uniforms);

    this.#uniformsBuffer = device.createBuffer({
      size: this.#uniformsData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.#uniformsBindGroup = device.createBindGroup({
      layout: this.#pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.#uniformsBuffer,
          },
        },
      ],
    });

    this.#init();
    this.#attach();
  }

  #init() {
    this.#setResolution();
    this.#setMousePositionClient(this.#canvas.clientWidth / 2, this.#canvas.clientHeight / 2);
  }

  #setResolution() {
    Uniforms.fields.resolution.write(new DataView(this.#uniformsData), [this.#canvas.width, this.#canvas.height, 0, 0]);
  }

  /**
   * @param {number} x
   * @param {number} y
   */
  #setMousePositionClient(x, y) {
    Uniforms.fields.mouse.write(new DataView(this.#uniformsData), [x * this.#pixelRatio, y * this.#pixelRatio, 0, 0]);
  }

  #attach() {
    this.#canvas.addEventListener('pointerdown', ev => {
      ev.preventDefault();
    });
    this.#canvas.addEventListener('pointermove', ev => {
      this.#setMousePositionClient(ev.offsetX, ev.offsetY);
    });
  }

  /**
   * @param {DOMHighResTimeStamp} timestamp
   * @param {GPUCommandEncoder} commandEncoder
   * @param {GPUTextureView} textureView
   */
  render(timestamp, commandEncoder, textureView) {
    const time = timestamp / 1000;

    Uniforms.fields.time.write(new DataView(this.#uniformsData), [time, 0, 0, 0]);

    this.#device.queue.writeBuffer(this.#uniformsBuffer, 0, this.#uniformsData);

    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
          view: textureView,
        },
      ],
      ...this.#gpuTiming.getPassDescriptorMixin(),
    });

    passEncoder.setPipeline(this.#pipeline);
    passEncoder.setBindGroup(0, this.#uniformsBindGroup);
    passEncoder.draw(6);

    passEncoder.end();
    this.#gpuTiming.trackPassEnd(commandEncoder);
  }

  readTiming() {
    return this.#gpuTiming.getResult();
  }
}
