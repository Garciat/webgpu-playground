import * as memory from "jsr:@garciat/wgpu-memory@1.2.6";

import { Instance, Vertex } from "./types.ts";

const LocVertex = 0;
const LocInstance = 4;

export const VertexBufferLayout: GPUVertexBufferLayout[] = [
  {
    attributes: [
      {
        shaderLocation: LocVertex + 0, // position
        offset: Vertex.fields.position.offset,
        format: "float32x4",
      },
      {
        shaderLocation: LocVertex + 1, // color
        offset: Vertex.fields.color.offset,
        format: "float32x4",
      },
      {
        shaderLocation: LocVertex + 2, // normal
        offset: Vertex.fields.normal.offset,
        format: "float32x3",
      },
      {
        shaderLocation: LocVertex + 3, // uv
        offset: Vertex.fields.uv.offset,
        format: "float32x2",
      },
    ],
    arrayStride: Vertex.byteSize,
    stepMode: "vertex",
  },
  {
    attributes: [
      {
        shaderLocation: LocInstance + 0, // tint
        offset: Instance.fields.tint.offset,
        format: "float32x4",
      },
      {
        shaderLocation: LocInstance + 1, // mvMatrix0
        offset: Instance.fields.mvMatrix.offset + memory.Vec4F.byteSize * 0,
        format: "float32x4",
      },
      {
        shaderLocation: LocInstance + 2, // mvMatrix1
        offset: Instance.fields.mvMatrix.offset + memory.Vec4F.byteSize * 1,
        format: "float32x4",
      },
      {
        shaderLocation: LocInstance + 3, // mvMatrix2
        offset: Instance.fields.mvMatrix.offset + memory.Vec4F.byteSize * 2,
        format: "float32x4",
      },
      {
        shaderLocation: LocInstance + 4, // mvMatrix3
        offset: Instance.fields.mvMatrix.offset + memory.Vec4F.byteSize * 3,
        format: "float32x4",
      },
      {
        shaderLocation: LocInstance + 5, // normalMatrix0
        offset: Instance.fields.normalMatrix.offset + memory.Vec4F.byteSize * 0,
        format: "float32x4",
      },
      {
        shaderLocation: LocInstance + 6, // normalMatrix1
        offset: Instance.fields.normalMatrix.offset + memory.Vec4F.byteSize * 1,
        format: "float32x4",
      },
      {
        shaderLocation: LocInstance + 7, // normalMatrix2
        offset: Instance.fields.normalMatrix.offset + memory.Vec4F.byteSize * 2,
        format: "float32x4",
      },
      {
        shaderLocation: LocInstance + 8, // normalMatrix3
        offset: Instance.fields.normalMatrix.offset + memory.Vec4F.byteSize * 3,
        format: "float32x4",
      },
    ],
    arrayStride: Instance.byteSize,
    stepMode: "instance",
  },
];

export function getBindGroupLayouts(device: GPUDevice) {
  return {
    uniformsBindLayout: device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {
            type: "uniform",
          },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {
            type: "uniform",
          },
        },
      ],
    }),
    lightsBindLayout: device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: {
            type: "read-only-storage",
          },
        },
      ],
    }),
    textureBindLayout: device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {
            type: "filtering",
          },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {
            sampleType: "float",
          },
        },
      ],
    }),
  };
}
