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
      identity4x4()
      * translation4x4f(input.translation)
      * rotation4x4f(input.rotation)
      * rotation4x4f(vec3f(0.0, time, 0.0))
      * scale4x4f(input.scale)
      * input.position
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

fn rotation4x4f(a: vec3f) -> mat4x4f {
  var c = vec3f(cos(a.x), cos(a.y), cos(a.z));
  var s = vec3f(sin(a.x), sin(a.y), sin(a.z));
  return mat4x4f(
    vec4f(c.y * c.z, c.y * s.z, -s.y, 0.0),
    vec4f(s.x * s.y * c.z - c.x * s.z, s.x * s.y * s.z + c.x * c.z, s.x * c.y, 0.0),
    vec4f(c.x * s.y * c.z + s.x * s.z, c.x * s.y * s.z - s.x * c.z, c.x * c.y, 0.0),
    vec4f(0.0, 0.0, 0.0, 1.0)
  );
}

fn translation4x4f(t: vec3f) -> mat4x4f {
  return mat4x4f(
    vec4f(1.0, 0.0, 0.0, 0.0),
    vec4f(0.0, 1.0, 0.0, 0.0),
    vec4f(0.0, 0.0, 1.0, 0.0),
    vec4f(t.x, t.y, t.z, 1.0)
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

fn identity4x4() -> mat4x4f {
  return scale4x4f(vec3f(1.0, 1.0, 1.0));
}
