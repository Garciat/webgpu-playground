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

export class FullscreenFragmentArt {
  #canvas;
  #device;
  #gpuTiming;

  #pixelRatio;

  #pipeline;

  #uniformsBuffer;
  #uniformsBindGroup;
  #uniformsData;
  #uniformsData_time;
  #uniformsData_resolution;
  #uniformsData_mouse;

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

    this.#uniformsData = new Float32Array(4 * 3);
    this.#uniformsData_time = this.#uniformsData.subarray(0, 4);
    this.#uniformsData_resolution = this.#uniformsData.subarray(4, 8);
    this.#uniformsData_mouse = this.#uniformsData.subarray(8, 12);

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
    this.#uniformsData_resolution[0] = this.#canvas.width;
    this.#uniformsData_resolution[1] = this.#canvas.height;
  }

  #setMousePositionClient(x, y) {
    this.#uniformsData_mouse[0] = x * this.#pixelRatio;
    this.#uniformsData_mouse[1] = y * this.#pixelRatio;
  }

  #attach() {
    this.#canvas.addEventListener('mousemove', ev => {
      this.#setMousePositionClient(ev.offsetX, ev.offsetY);
    });
  }

  render(timestamp, commandEncoder, textureView) {
    const time = timestamp / 1000;
    this.#uniformsData_time[0] = time;

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
