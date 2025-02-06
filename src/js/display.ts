/// <reference types="npm:@webgpu/types" />

export class Styles {
  static set(
    element: HTMLElement,
    style: { [key: string]: string | number | CSSUnitValue },
  ) {
    for (const key of Object.keys(style)) {
      element.style.setProperty(key, String(style[key]));
    }
  }
}

export class Screen {
  static setup(body: HTMLElement, pixelRatio: number = 1) {
    const html = body.parentElement;
    if (!html) {
      throw Error("No HTML element found");
    }

    Styles.set(html, {
      width: CSS.percent(100),
      height: CSS.percent(100),
    });

    Styles.set(body, {
      margin: 0,
      width: CSS.percent(100),
      height: CSS.percent(100),
      display: "flex",
      "place-content": "center center",
      "background-color": "black",
    });

    const canvas = document.createElement("canvas");
    Styles.set(canvas, {
      width: CSS.percent(100),
      height: CSS.percent(100),
      "touch-action": "none",
    });

    const displayW = body.clientWidth;
    const displayH = body.clientHeight;

    canvas.width = displayW * pixelRatio;
    canvas.height = displayH * pixelRatio;

    body.appendChild(canvas);

    {
      const obs = new ResizeObserver((entries) => {
        const { width, height } = entries[0].contentRect;
        canvas.width = width * pixelRatio;
        canvas.height = height * pixelRatio;
      });
      obs.observe(document.body);
    }

    return { canvas };
  }

  static async gpu(
    navigatorGPU: GPU,
    canvas: HTMLCanvasElement,
    { requiredFeatures = [], optionalFeatures = [] }: {
      requiredFeatures?: GPUFeatureName[];
      optionalFeatures?: GPUFeatureName[];
    },
  ): Promise<{
    adapter: GPUAdapter;
    device: GPUDevice;
    context: GPUCanvasContext;
    canvasTextureFormat: GPUTextureFormat;
  }> {
    if (!navigatorGPU) {
      throw Error("WebGPU not supported");
    }

    const adapter = await navigatorGPU.requestAdapter();
    if (!adapter) {
      throw Error("Couldn't request WebGPU adapter.");
    }

    const features = [
      ...requiredFeatures,
      ...optionalFeatures.filter((feature) => adapter.features.has(feature)),
    ];

    const device = await adapter.requestDevice({ requiredFeatures: features });
    if (!device) {
      throw Error("Couldn't request WebGPU device.");
    }

    const context = canvas.getContext("webgpu");
    if (!context) {
      throw Error("Couldn't get WebGPU context.");
    }

    context.configure({
      device: device,
      format: "rgba16float",
      colorSpace: "display-p3",
      toneMapping: {
        mode: "extended",
      },
      alphaMode: "premultiplied",
    });

    return {
      adapter,
      device,
      context,
      canvasTextureFormat: context.getCurrentTexture().format,
    };
  }
}
