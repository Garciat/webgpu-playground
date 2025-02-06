const LocVertex = 0;
struct VertexIn {
  @location(LocVertex+0) position : vec2f,
  @location(LocVertex+1) velocity : vec2f,
  @location(LocVertex+2) color : vec4f,
}

struct VertexOut {
  @builtin(position) position : vec4f,
  @location(0) color : vec4f,
}

struct FragmentOut {
  @location(0) color : vec4f,
}

@vertex
fn vertex_main(model : VertexIn) -> VertexOut
{
  var output : VertexOut;
  output.position = vec4((model.position - vec2f(0.5, 0.5)) * 2, 0.0, 1.0);
  output.color = model.color;
  return output;
}

@fragment
fn fragment_main(fragData : VertexOut) -> FragmentOut
{
  var output : FragmentOut;
  output.color = fragData.color;
  return output;
}
