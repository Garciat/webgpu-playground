/// <reference types="npm:@webgpu/types" />

import { Styles } from "./display.ts";

// Source: https://webgpufundamentals.org/webgpu/lessons/webgpu-timing.html

export class RollingAverage {
  #total: number = 0;
  #samples: number[] = [];
  #cursor: number = 0;
  #numSamples: number;

  constructor(numSamples = 100) {
    this.#numSamples = numSamples;
  }

  addSample(v: number) {
    this.#total += v - (this.#samples[this.#cursor] || 0);
    this.#samples[this.#cursor] = v;
    this.#cursor = (this.#cursor + 1) % this.#numSamples;
  }

  get() {
    return this.#total / this.#samples.length;
  }
}

type TimingValues = {
  fps: number;
  js: number;
  gpu: number;
};

export class TimingManager {
  #fps: RollingAverage;
  #js: RollingAverage;
  #gpu: RollingAverage;

  #lastFrameTimestamp = 0;
  #currentFrameTimestamp = 0;
  #frameStartTimestamp = 0;

  constructor(
    fpsSummary: RollingAverage,
    jsSummary: RollingAverage,
    gpuSummary: RollingAverage,
  ) {
    this.#fps = fpsSummary;
    this.#js = jsSummary;
    this.#gpu = gpuSummary;
  }

  beginFrame(timestamp: DOMHighResTimeStamp) {
    this.#currentFrameTimestamp = timestamp;
    this.#frameStartTimestamp = performance.now();
  }

  endFrame(gpuTimePromise: Promise<number | undefined>): TimingValues {
    const frameEndTimestamp = performance.now();
    const jsTime = frameEndTimestamp - this.#frameStartTimestamp;

    const frameTime = (this.#currentFrameTimestamp - this.#lastFrameTimestamp) /
      1000;
    this.#lastFrameTimestamp = this.#currentFrameTimestamp;

    gpuTimePromise.then((gpuTime) => {
      if (gpuTime !== undefined) {
        this.#gpu.addSample(gpuTime / 1000);
      }
    });

    this.#fps.addSample(1 / frameTime);
    this.#js.addSample(jsTime);

    return {
      fps: this.#fps.get(),
      js: this.#js.get(),
      gpu: this.#gpu.get(),
    };
  }
}

export class TimingValuesDisplay {
  #style = {
    contain: "strict",
    width: CSS.em(8),
    height: CSS.em(3.5),
    overflow: "hidden",
    position: "absolute",
    top: 0,
    left: 0,
    margin: 0,
    padding: CSS.em(0.5),
    "background-color": "rgba(0, 0, 0, 0.8)",
    color: "white",
  };

  #element: HTMLElement;
  #textNode: Text;

  constructor(parent: HTMLElement) {
    this.#element = document.createElement("pre");
    Styles.set(this.#element, this.#style);
    parent.appendChild(this.#element);

    this.#textNode = document.createTextNode("");
    this.#element.appendChild(this.#textNode);

    // HACK
    if (globalThis.location.hash.includes("timing=no")) {
      this.#element.style.display = "none";
    }
  }

  display(timingValues: TimingValues) {
    this.#textNode.nodeValue = `\
fps: ${timingValues.fps.toFixed(1)}
js: ${timingValues.js.toFixed(3)}ms
gpu: ${isNaN(timingValues.gpu) ? "N/A" : `${timingValues.gpu.toFixed(1)}µs`}
`;
  }
}

export interface GPUTiming {
  getPassDescriptorMixin(): Partial<GPURenderPassDescriptor>;
  trackPassEnd(encoder: GPUCommandEncoder): void;
  getResult(): Promise<number | undefined>;
}

export function createGPUTimingAdapter(device: GPUDevice): GPUTiming {
  if (device.features.has("timestamp-query")) {
    return new GPUTimingAdapter(device);
  } else {
    return new GPUTimingNoop();
  }
}

class GPUTimingNoop implements GPUTiming {
  getPassDescriptorMixin() {
    return {};
  }

  trackPassEnd() {}

  getResult() {
    return Promise.resolve(NaN);
  }
}

class GPUTimingAdapter implements GPUTiming {
  #querySet: GPUQuerySet;
  #resolveBuffer: GPUBuffer;
  #resultBuffer: GPUBuffer;

  constructor(device: GPUDevice) {
    this.#querySet = device.createQuerySet({
      type: "timestamp",
      count: 2, // begin and end
    });

    this.#resolveBuffer = device.createBuffer({
      size: this.#querySet.count * BigInt64Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
    });

    this.#resultBuffer = device.createBuffer({
      size: this.#resolveBuffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
  }

  getPassDescriptorMixin(): Partial<GPURenderPassDescriptor> {
    return {
      timestampWrites: {
        querySet: this.#querySet,
        beginningOfPassWriteIndex: 0,
        endOfPassWriteIndex: 1,
      },
    };
  }

  trackPassEnd(encoder: GPUCommandEncoder) {
    encoder.resolveQuerySet(
      this.#querySet,
      0,
      this.#querySet.count,
      this.#resolveBuffer,
      0,
    );

    if (this.#resultBuffer.mapState === "unmapped") {
      // if unmapped, it is available for writing
      encoder.copyBufferToBuffer(
        this.#resolveBuffer,
        0,
        this.#resultBuffer,
        0,
        this.#resultBuffer.size,
      );
    }
  }

  async getResult() {
    if (this.#resultBuffer.mapState === "unmapped") {
      // if unmapped, it is available for mapping & reading
      const resultBuffer = this.#resultBuffer;
      await resultBuffer.mapAsync(GPUMapMode.READ);
      const times = new BigInt64Array(resultBuffer.getMappedRange());
      const duration = Number(times[1] - times[0]);
      resultBuffer.unmap(); // eventual
      return duration;
    } else {
      // cannot read yet
      return undefined;
    }
  }
}
