struct Uniforms {
  projectionMatrix : mat4x4f,
}
@group(0) @binding(0) var<uniform> time : f32;
@group(0) @binding(1) var<uniform> uniforms : Uniforms;

struct VertexIn {
  @location(0) position : vec4f,
  @location(1) color : vec4f,
}

struct InstanceIn {
  @location(2) tint : vec4f,

  @location(3) mvMatrix0 : vec4f,
  @location(4) mvMatrix1 : vec4f,
  @location(5) mvMatrix2 : vec4f,
  @location(6) mvMatrix3 : vec4f,

  @location(7) mvInvMatrix0 : vec4f,
  @location(8) mvInvMatrix1 : vec4f,
  @location(9) mvInvMatrix2 : vec4f,
  @location(10) mvInvMatrix3 : vec4f,
}

fn mv_matrix(instance: InstanceIn) -> mat4x4f {
  return mat4x4f(
    instance.mvMatrix0,
    instance.mvMatrix1,
    instance.mvMatrix2,
    instance.mvMatrix3,
  );
}

fn mv_inv_matrix(instance: InstanceIn) -> mat4x4f {
  return mat4x4f(
    instance.mvInvMatrix0,
    instance.mvInvMatrix1,
    instance.mvInvMatrix2,
    instance.mvInvMatrix3,
  );
}

struct VertexOut {
  @builtin(position) position : vec4f,
  @location(0) color : vec4f,
}

struct FragmentOut {
  @location(0) color : vec4f,
}

@vertex
fn vertex_main(model: VertexIn, instance: InstanceIn) -> VertexOut
{
  let _t = time; // keep the compiler happy

  var output : VertexOut;
  output.position = uniforms.projectionMatrix * mv_matrix(instance) * model.position;
  output.color = model.color * instance.tint;
  return output;
}

@fragment
fn fragment_main(fragData: VertexOut) -> FragmentOut
{
  var output : FragmentOut;
  output.color = fragData.color;
  return output;
}
