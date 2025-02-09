/// <reference types="npm:@webgpu/types" />

import { Styles } from "./display.ts";
import { isEmbedded } from "./utils.ts";

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
    if (isNaN(v) || !isFinite(v)) {
      return;
    }
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
  gpu: Record<string, number>;
};

export class TimingManager<Descriptor extends GPUTimingDescriptor> {
  #fps: RollingAverage;
  #js: RollingAverage;
  #gpu: { [Name in keyof Descriptor]: RollingAverage };

  #lastFrameTimestamp = 0;
  #currentFrameTimestamp = 0;
  #frameStartTimestamp = 0;

  constructor(
    fpsSummary: RollingAverage,
    jsSummary: RollingAverage,
    gpuSummary: { [Name in keyof Descriptor]: RollingAverage },
  ) {
    this.#fps = fpsSummary;
    this.#js = jsSummary;
    this.#gpu = gpuSummary;
  }

  beginFrame(timestamp: DOMHighResTimeStamp) {
    this.#currentFrameTimestamp = timestamp;
    this.#frameStartTimestamp = performance.now();
  }

  endFrame(
    gpuTimePromise: Promise<Record<string, number> | undefined>,
  ): TimingValues {
    const frameEndTimestamp = performance.now();
    const jsTime = frameEndTimestamp - this.#frameStartTimestamp;

    const frameTime = (this.#currentFrameTimestamp - this.#lastFrameTimestamp) /
      1000;
    this.#lastFrameTimestamp = this.#currentFrameTimestamp;

    gpuTimePromise.then((gpuTime) => {
      if (gpuTime !== undefined) {
        for (const name in gpuTime) {
          this.#gpu[name].addSample(gpuTime[name] / 1000);
        }
      }
    });

    this.#fps.addSample(1 / frameTime);
    this.#js.addSample(jsTime * 1000);

    return {
      fps: this.#fps.get(),
      js: this.#js.get(),
      gpu: mapObjectValues(this.#gpu, (average) => average.get()),
    };
  }
}

export class TimingValuesDisplay {
  #style = {
    // contain: "strict",
    // width: CSS.em(8),
    // height: CSS.em(3.5),
    overflow: "hidden",
    position: "absolute",
    top: 0,
    left: 0,
    margin: 0,
    padding: CSS.em(0.5),
    "background-color": "rgba(0, 0, 0, 1)",
    color: "white",
    "font-size": "10px",
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
    if (isEmbedded()) {
      this.#element.style.display = "none";
    }
  }

  display(timingValues: TimingValues) {
    this.#textNode.nodeValue = `\
fps: ${timingValues.fps.toFixed(1)}
js: ${timingValues.js.toFixed(1)}µs
${this.formatGPUTimes(timingValues.gpu)}
`;
  }

  formatGPUTimes(times: Record<string, number>) {
    return Object.entries(times).map(([key, time]) =>
      `${key}: ${isNaN(time) ? "N/A" : `${time.toFixed(1)}µs`}`
    ).join("\n");
  }
}

export type GPUTimingDescriptor = {
  [Name in string]: Record<string, never>;
};

export interface GPUTiming<Descriptor extends GPUTimingDescriptor> {
  getPassDescriptorMixin(
    name: keyof Descriptor,
  ): Partial<GPURenderPassDescriptor>;
  trackPassEnd(encoder: GPUCommandEncoder): void;
  getResult(): Promise<{ [Name in keyof Descriptor]: number } | undefined>;
}

export function createGPUTimingAdapter<Descriptor extends GPUTimingDescriptor>(
  device: GPUDevice,
  descriptor: Descriptor,
): GPUTiming<Descriptor> {
  if (device.features.has("timestamp-query")) {
    return new GPUTimingAdapter(descriptor, device);
  } else {
    return new GPUTimingNoop(descriptor);
  }
}

class GPUTimingNoop<Descriptor extends GPUTimingDescriptor>
  implements GPUTiming<Descriptor> {
  #descriptor: Descriptor;
  #empty: { [Name in keyof Descriptor]: number };

  constructor(descriptor: Descriptor) {
    this.#descriptor = descriptor;
    this.#empty = mapObjectValues(descriptor, () => NaN);
  }

  getPassDescriptorMixin() {
    return {};
  }

  trackPassEnd() {}

  getResult() {
    return Promise.resolve(this.#empty);
  }
}

class GPUTimingAdapter<Descriptor extends GPUTimingDescriptor>
  implements GPUTiming<Descriptor> {
  #indices: { [Name in keyof Descriptor]: number };
  #querySet: GPUQuerySet;
  #resolveBuffer: GPUBuffer;
  #resultBuffer: GPUBuffer;

  constructor(descriptor: Descriptor, device: GPUDevice) {
    const count = Object.keys(descriptor).length;

    let index = 0;
    this.#indices = mapObjectValues(descriptor, () => 2 * index++);

    this.#querySet = device.createQuerySet({
      type: "timestamp",
      count: 2 * count, // begin and end
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

  getPassDescriptorMixin(
    name: keyof Descriptor,
  ): Partial<GPURenderPassDescriptor> {
    const index = this.#indices[name];
    return {
      timestampWrites: {
        querySet: this.#querySet,
        beginningOfPassWriteIndex: index,
        endOfPassWriteIndex: index + 1,
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
      const result = mapObjectValues(this.#indices, (index) => {
        const begin = times[index];
        const end = times[index + 1];
        return Number(end - begin);
      });
      resultBuffer.unmap(); // eventual
      return result;
    } else {
      // cannot read yet
      return undefined;
    }
  }
}

function mapObjectValues<
  T extends { [Key in keyof T]: V },
  R,
  V = ObjectValues<T>,
>(
  input: T,
  fn: (value: V) => R,
): { [Key in keyof T]: R } {
  const result = {} as { [Key in keyof T]: R };
  for (const key in input) {
    result[key] = fn(input[key]);
  }
  return result;
}

type ObjectValues<T> = T[keyof T];
