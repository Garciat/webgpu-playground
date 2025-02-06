struct RenderParams {
  resolution : vec2f,
}

@binding(0) @group(0) var<uniform> render_params : RenderParams;

const LocParticle = 0;
const LocQuad = LocParticle + 3;
struct VertexIn {
  @location(LocParticle+0) position : vec2f,
  @location(LocParticle+1) velocity : vec2f,
  @location(LocParticle+2) color : vec4f,
  @location(LocQuad+0) quad_pos : vec2f,
}

struct VertexOut {
  // screen space position
  // x in [-resolution.x/2, resolution.x/2]
  // y in [-resolution.y/2, resolution.y/2]
  @builtin(position) position : vec4f,
  @location(0) color : vec4f,
  @location(1) quad_pos : vec2f,
}

struct FragmentOut {
  @location(0) color : vec4f,
}

const sprite_size_px = 5;

@vertex
fn vertex_main(vertex : VertexIn) -> VertexOut
{
  let aspect = render_params.resolution.y / render_params.resolution.x;
  let pixel_scale = 2/render_params.resolution.y;

  // position in clip space
  let position = vertex.position / (render_params.resolution/2);

  let sprite = vertex.quad_pos * vec2f(aspect, 1.0) * sprite_size_px * pixel_scale;

  var output : VertexOut;
  output.position = vec4f(position + sprite, 0, 1);
  output.color = vertex.color;
  output.quad_pos = vertex.quad_pos;
  return output;
}

@fragment
fn fragment_main(frag : VertexOut) -> FragmentOut
{
  var color = frag.color;
  color.a = color.a * max(1.0 - length(frag.quad_pos), 0.0);
  var output : FragmentOut;
  output.color = color;
  return output;
}
