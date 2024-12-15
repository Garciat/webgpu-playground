struct Uniforms {
  modelViewProjectionMatrix : mat4x4f,
}
@group(0) @binding(0) var<uniform> time : f32;
@group(0) @binding(1) var<uniform> uniforms : Uniforms;

// Locations: buffers.[*].attributes.[*].shaderLocation
struct VertexIn {
  @location(0) position : vec4f,
  @location(1) color : vec4f,
  @location(2) transform_v1 : vec4f,
  @location(3) transform_v2 : vec4f,
  @location(4) transform_v3 : vec4f,
  @location(5) transform_v4 : vec4f,
  @location(6) tint : vec4f,
}

fn vertexTransform(v: VertexIn) -> mat4x4f {
  return mat4x4f(v.transform_v1, v.transform_v2, v.transform_v3, v.transform_v4);
}

struct VertexOut {
  @builtin(position) position : vec4f,
  @location(0) color : vec4f,
}

struct FragmentOut {
  @location(0) color : vec4f,
}

@vertex
fn vertex_main(input: VertexIn) -> VertexOut
{
  var output : VertexOut;
  output.position =
    uniforms.modelViewProjectionMatrix
    * (
      input.position
      * rotation4x4f(time)
      * vertexTransform(input)
    );
  output.color = input.color * input.tint;
  return output;
}

@fragment
fn fragment_main(fragData: VertexOut) -> FragmentOut
{
  var output : FragmentOut;
  output.color = fragData.color;
  return output;
}

fn rotation4x4f(angle: f32) -> mat4x4f {
  let c = cos(angle);
  let s = sin(angle);
  return mat4x4f(
    vec4f(c, -s, 0.0, 0.0),
    vec4f(s, c, 0.0, 0.0),
    vec4f(0.0, 0.0, 1.0, 0.0),
    vec4f(0.0, 0.0, 0.0, 1.0),
  );
}
