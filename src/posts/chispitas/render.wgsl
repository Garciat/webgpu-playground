struct RenderParams {
  modelViewProjectionMatrix : mat4x4f,
  right : vec3f,
  up : vec3f,
}

@binding(0) @group(0) var<uniform> render_params : RenderParams;

const LocParticle = 0;
const LocQuad = LocParticle + 4;
struct VertexIn {
  @location(LocParticle+0) position : vec2f,
  @location(LocParticle+1) velocity : vec2f,
  @location(LocParticle+2) color : vec4f,
  @location(LocParticle+3) radius : f32,
  @location(LocQuad+0) quad_pos : vec2f,
}

struct VertexOut {
  @builtin(position) position : vec4f,
  @location(0) color : vec4f,
  @location(1) quad_pos : vec2f,
}

struct FragmentOut {
  @location(0) color : vec4f,
}

@vertex
fn vertex_main(vertex : VertexIn) -> VertexOut
{
  let quad_pos = mat2x3f(render_params.right, render_params.up) * vertex.quad_pos;
  let position = vec3f(vertex.position, 0.0) + quad_pos * vertex.radius;

  var output : VertexOut;
  output.position = render_params.modelViewProjectionMatrix * vec4f(position, 1.0);
  output.color = vertex.color;
  output.quad_pos = vertex.quad_pos;
  return output;
}

@fragment
fn fragment_main(frag : VertexOut) -> FragmentOut
{
  var color = frag.color;
  color.a = color.a * step(0.1, max(1.0 - length(frag.quad_pos), 0.0));
  var output : FragmentOut;
  output.color = color;
  return output;
}
