struct Uniforms {
  modelViewProjectionMatrix : mat4x4f,
}
@group(0) @binding(0) var<uniform> time : f32;
@group(0) @binding(1) var<uniform> uniforms : Uniforms;

// Locations: buffers.[*].attributes.[*].shaderLocation
struct VertexIn {
  // vertex
  @location(0) position : vec4f,
  @location(1) color : vec4f,
  // instance
  @location(2) translation : vec3f,
  @location(3) scale : vec3f,
  @location(4) rotation : vec3f,
  @location(5) tint : vec4f,
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
      * scale4x4f(input.scale)
      * rotation4x4f(input.rotation.z + time)
      * translation4x4f(input.translation)
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

fn translation4x4f(t: vec3f) -> mat4x4f {
  return mat4x4f(
    vec4f(1.0, 0.0, 0.0, t.x),
    vec4f(0.0, 1.0, 0.0, t.y),
    vec4f(0.0, 0.0, 1.0, t.z),
    vec4f(0.0, 0.0, 0.0, 1.0)
  );
}

fn scale4x4f(s: vec3f) -> mat4x4f {
  return mat4x4f(
    vec4f(s.x, 0.0, 0.0, 0.0),
    vec4f(0.0, s.y, 0.0, 0.0),
    vec4f(0.0, 0.0, s.z, 0.0),
    vec4f(0.0, 0.0, 0.0, 1.0)
  );
}
