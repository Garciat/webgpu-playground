struct Uniforms {
  time : vec4f,
  resolution : vec4f,
}

@group(0) @binding(0) var<uniform> uniforms : Uniforms;

struct VertexIn {
  @builtin(vertex_index) index : u32,
}

struct VertexOut {
  @builtin(position) position : vec4f,
}

struct FragmentOut {
  @location(0) color : vec4f,
}

@vertex
fn vertex_main(vertex : VertexIn) -> VertexOut {
  const pos = array(
    vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0),
    vec2(-1.0, 1.0), vec2(1.0, -1.0), vec2(1.0, 1.0),
  );

  var output : VertexOut;
  output.position = vec4f(pos[vertex.index], 0.0, 1.0);
  return output;
}

@fragment
fn fragment_main(fragment : VertexOut) -> FragmentOut {
  let t = uniforms.time.x; // time in seconds

  let uv = (fragment.position.xy * 2.0 - uniforms.resolution.xy) / uniforms.resolution.y;

  var col = vec3f(1, 2, 3);

  var d = length(uv);
  d = sin(d*8 + t)/8;
  d = abs(d);
  d = 0.02 / d;

  col *= d;

  var output : FragmentOut;
  output.color = vec4f(col, 1.0);
  return output;
}
