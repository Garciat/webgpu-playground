// Clear color for GPURenderPassDescriptor
const clearColor = { r: 0.2, g: 0.2, b: 0.2, a: 1.0 };

// Vertex data for triangle
// Each vertex has 8 values representing position and color: X Y Z W R G B A

const vertices = new Float32Array([
  0.0,  0.6, 0, 1, 1, 1, 1, 1,
 -0.5, -0.6, 0, 1, 1, 1, 1, 1,
  0.5, -0.6, 0, 1, 5, 5, 5, 1
]);

// Main function

async function init() {
  const textureFormat = 'rgba16float';

  // 0: download shader

  const shaders = await fetch('shaders.wgsl').then(response => response.text());

  // 1: request adapter and device
  if (!navigator.gpu) {
    throw Error('WebGPU not supported.');
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw Error('Couldn\'t request WebGPU adapter.');
  }

  console.log('Adapter:', adapter);

  let device = await adapter.requestDevice();

  // 2: Create a shader module from the shaders template literal
  const shaderModule = device.createShaderModule({
    code: shaders
  });

  // 3: Get reference to the canvas to render on
  const canvas = document.querySelector('#gpuCanvas');
  canvas.width = document.body.clientWidth;
  canvas.height = document.body.clientHeight;

  const context = canvas.getContext('webgpu');

  context.configure({
    device: device,
    format: textureFormat,
    colorSpace: 'display-p3',
    toneMapping: {
      mode: 'extended',
    },
    alphaMode: 'premultiplied'
  });

  // 4: Create vertex buffer to contain vertex data
  const vertexBuffer = device.createBuffer({
    size: vertices.byteLength, // make it big enough to store vertices in
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  // Copy the vertex data over to the GPUBuffer using the writeBuffer() utility function
  device.queue.writeBuffer(vertexBuffer, 0, vertices, 0, vertices.length);

  // 5: Create a GPUVertexBufferLayout and GPURenderPipelineDescriptor to provide a definition of our render pipline
  const vertexBuffers = [{
    attributes: [{
      shaderLocation: 0, // position
      offset: 0,
      format: 'float32x4'
    }, {
      shaderLocation: 1, // color
      offset: 16,
      format: 'float32x4'
    }],
    arrayStride: 32,
    stepMode: 'vertex'
  }];

  const pipelineDescriptor = {
    vertex: {
      module: shaderModule,
      entryPoint: 'vertex_main',
      buffers: vertexBuffers
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fragment_main',
      targets: [{
        format: textureFormat
      }]
    },
    primitive: {
      topology: 'triangle-list'
    },
    layout: 'auto'
  };

  // 6: Create the actual render pipeline

  const renderPipeline = device.createRenderPipeline(pipelineDescriptor);

  // 7: Create GPUCommandEncoder to issue commands to the GPU
  // Note: render pass descriptor, command encoder, etc. are destroyed after use, fresh one needed for each frame.
  const commandEncoder = device.createCommandEncoder();

  // 8: Create GPURenderPassDescriptor to tell WebGPU which texture to draw into, then initiate render pass

  const renderPassDescriptor = {
    colorAttachments: [{
      clearValue: clearColor,
      loadOp: 'clear',
      storeOp: 'store',
      view: context.getCurrentTexture().createView()
    }]
  };

  const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

  // 9: Draw the triangle

  passEncoder.setPipeline(renderPipeline);
  passEncoder.setVertexBuffer(0, vertexBuffer);
  passEncoder.draw(3);

  // End the render pass
  passEncoder.end();

  // 10: End frame by passing array of command buffers to command queue for execution
  device.queue.submit([commandEncoder.finish()]);
}

init();
