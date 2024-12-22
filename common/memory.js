// Meta types

const TYPE_PRIMITIVE = 'primitive';
const TYPE_VECTOR = 'vector';
const TYPE_MATRIX = 'matrix';
const TYPE_STRUCT = 'struct';
const TYPE_ARRAY = 'array';

// Public helpers

export function allocate(type, count = 1) {
  return new ArrayBuffer(type.byteSize * count);
}

// Internal helpers

function assert(condition, message) {
  if (!condition) {
    throw Error(message);
  }
}

// Array type

export class ArrayOf {
  #type;
  #length;

  constructor(type, length) {
    this.#type = type;
    this.#length = length;
  }

  get type() {
    return TYPE_ARRAY;
  }

  toString() {
    return `Array(${this.#type.toString()}, ${this.#length})`;
  }

  get byteSize() {
    return this.#type.byteSize * this.#length;
  }

  get alignment() {
    return this.#type.alignment;
  }

  count(view) {
    return view.byteLength / this.byteSize;
  }

  read(view, offset=0) {
    const values = Array(this.#length);

    for (let i = 0; i < this.#length; i++) {
      values[i] = this.#type.read(view, offset + i * this.#type.byteSize);
    }

    return values;
  }

  write(view, values, offset=0) {
    for (let i = 0; i < this.#length; i++) {
      this.#type.write(view, values[i], offset + i * this.#type.byteSize);
    }
  }

  readAt(view, index, offset=0) {
    return read(view, index * this.byteSize + offset);
  }

  writeAt(view, index, value, offset=0) {
    write(view, value, index * this.byteSize + offset);
  }

  view(buffer, offset=0, length=1) {
    return this.#type.view(buffer, offset, length * this.#length);
  }

  get(view, index, offset=0) {
    return this.#type.read(view, offset + index * this.#type.byteSize);
  }

  set(view, index, value, offset=0) {
    this.#type.write(view, value, offset + index * this.#type.byteSize);
  }
}

// Struct type

export class Struct {
  /**
   * @type {Array<StructField>} fields
   */
  #fields;

  /**
   * @type {{[name: string]: StructField}} fieldsByName
   */
  #fieldsByName;

  /**
   * @type {number} size
   */
  #size;

  /**
   * @param {{name: string, type: any}[]} fields
   */
  constructor(fields) {
    let offset = 0;

    this.#fields = fields.map((descriptor, index) => {
      const field = new StructField(this, index, descriptor.name, descriptor.type, offset);
      offset += field.byteSize; // TODO: alignment?
      return field;
    });

    this.#fieldsByName = {};
    for (const field of this.#fields) {
      assert(!this.#fieldsByName[field.name], `Duplicate field name: ${field.name}`);
      this.#fieldsByName[field.name] = field;
    }

    this.#size = offset;
  }

  get type() {
    return TYPE_STRUCT;
  }

  get fields() {
    return this.#fieldsByName;
  }

  toString() {
    return `Struct(${this.#fields.map(field => `${field.name}: ${field.type.toString()}`).join(', ')})`;
  }

  get byteSize() {
    return this.#size;
  }

  get alignment() {
    return 4; // TODO: alignment?
  }

  count(view) {
    return view.byteLength / this.byteSize;
  }

  read(view, offset=0) {
    const values = Array(this.#fields.length);

    for (const field of this.#fields) {
      values[field.index] = field.type.read(view, offset + field.offset);
    }

    return values;
  }

  write(view, values, offset=0) {
    for (const field of this.#fields) {
      field.type.write(view, values[field.index], offset + field.offset);
    }
  }

  readObject(view, offset=0) {
    const obj = {};

    for (const field of this.#fields) {
      obj[field.name] = field.type.read(view, offset + field.offset);
    }

    return obj;
  }

  writeObject(view, values, offset=0) {
    for (const field of this.#fields) {
      field.type.write(view, values[field.name], offset + field.offset);
    }
  }

  readAt(view, index, offset=0) {
    return read(view, index * this.byteSize + offset);
  }

  writeAt(view, index, value, offset=0) {
    write(view, value, index * this.byteSize + offset);
  }

  readObjectAt(view, index, offset=0) {
    return this.readObject(view, index * this.byteSize + offset);
  }

  writeObjectAt(view, index, value, offset=0) {
    this.writeObject(view, value, index * this.byteSize + offset);
  }

  view(buffer, offset=0, length=1) {
    // TODO: ok to default to Float32?
    return Float32.view(buffer, offset, this.#size * length / Float32.byteSize);
  }

  viewObject(buffer, offset=0) {
    const obj = {};

    for (const field of this.#fields) {
      obj[field.name] = field.type.view(buffer, offset + field.offset);
    }

    return obj;
  }

  viewObjectAt(buffer, index, offset=0) {
    return this.viewObject(buffer, index * this.byteSize + offset);
  }
}

class StructField {
  #parent;
  #index;
  #name;
  #type;
  #offset;

  constructor(parent, index, name, type, offset) {
    this.#parent = parent;
    this.#index = index;
    this.#name = name;
    this.#type = type;
    this.#offset = offset;
  }

  get name() {
    return this.#name;
  }

  get index() {
    return this.#index;
  }

  get type() {
    return this.#type;
  }

  get byteSize() {
    return this.#type.byteSize;
  }

  get alignment() {
    return this.#type.alignment;
  }

  get offset() {
    return this.#offset;
  }

  read(view, offset=0) {
    return this.#type.read(view, this.#offset + offset);
  }

  write(view, value, offset=0) {
    this.#type.write(view, value, this.#offset + offset);
  }

  view(buffer, offset=0, length=1) {
    return this.#type.view(buffer, this.#offset + offset, length);
  }
}

// Matrix types

export class Mat2x2 {
  #type;

  constructor(type) {
    assert(type.type === TYPE_PRIMITIVE, 'Matrix type must be a primitive type');
    this.#type = type;
  }

  get type() {
    return TYPE_MATRIX;
  }

  toString() {
    return `Mat2x2(${this.#type.toString()})`;
  }

  get byteSize() {
    return this.#type.byteSize * 4;
  }

  get alignment() {
    return this.#type.alignment;
  }

  count(view) {
    return view.byteLength / this.byteSize;
  }

  index(row, column) {
    return row * 2 + column;
  }

  offset(row, column) {
    return this.index(row, column) * this.#type.byteSize;
  }

  read(view, offset=0) {
    return [
      this.get(view, 0, 0, offset),
      this.get(view, 0, 1, offset),
      this.get(view, 1, 0, offset),
      this.get(view, 1, 1, offset),
    ];
  }

  write(view, value, offset=0) {
    this.set(view, value[0], 0, 0, offset);
    this.set(view, value[1], 0, 1, offset);
    this.set(view, value[2], 1, 0, offset);
    this.set(view, value[3], 1, 1, offset);
  }

  readAt(view, index, offset=0) {
    return read(view, index * this.byteSize + offset);
  }

  writeAt(view, index, value, offset=0) {
    write(view, value, index * this.byteSize + offset);
  }

  get(view, row, column, offset=0) {
    return this.#type.read(view, offset + this.offset(row, column));
  }

  set(view, value, row, column, offset=0) {
    this.#type.write(view, value, offset + this.offset(row, column));
  }

  view(buffer, offset=0, length=1) {
    return this.#type.view(buffer, offset, length * 4);
  }
}

export class Mat3x3 {
  #type;

  constructor(type) {
    assert(type.type === TYPE_PRIMITIVE, 'Matrix type must be a primitive type');
    this.#type = type;
  }

  get type() {
    return TYPE_MATRIX;
  }

  toString() {
    return `Mat3x3(${this.#type.toString()})`;
  }

  get byteSize() {
    return this.#type.byteSize * 9;
  }

  get alignment() {
    return this.#type.alignment;
  }

  count(view) {
    return view.byteLength / this.byteSize;
  }

  index(row, column) {
    return row * 3 + column;
  }

  offset(row, column) {
    return this.index(row, column) * this.#type.byteSize;
  }

  read(view, offset=0) {
    return [
      this.get(view, 0, 0, offset),
      this.get(view, 0, 1, offset),
      this.get(view, 0, 2, offset),
      this.get(view, 1, 0, offset),
      this.get(view, 1, 1, offset),
      this.get(view, 1, 2, offset),
      this.get(view, 2, 0, offset),
      this.get(view, 2, 1, offset),
      this.get(view, 2, 2, offset),
    ];
  }

  write(view, value, offset=0) {
    this.set(view, value[0], 0, 0, offset);
    this.set(view, value[1], 0, 1, offset);
    this.set(view, value[2], 0, 2, offset);
    this.set(view, value[3], 1, 0, offset);
    this.set(view, value[4], 1, 1, offset);
    this.set(view, value[5], 1, 2, offset);
    this.set(view, value[6], 2, 0, offset);
    this.set(view, value[7], 2, 1, offset);
    this.set(view, value[8], 2, 2, offset);
  }

  readAt(view, index, offset=0) {
    return read(view, index * this.byteSize + offset);
  }

  writeAt(view, index, value, offset=0) {
    write(view, value, index * this.byteSize + offset);
  }

  get(view, row, column, offset=0) {
    return this.#type.read(view, offset + this.offset(row, column));
  }

  set(view, value, row, column, offset=0) {
    this.#type.write(view, value, offset + this.offset(row, column));
  }

  view(buffer, offset=0, length=1) {
    return this.#type.view(buffer, offset, length * 9);
  }
}

export class Mat4x4 {
  #type;

  constructor(type) {
    assert(type.type === TYPE_PRIMITIVE, 'Matrix type must be a primitive type');
    this.#type = type;
  }

  get type() {
    return TYPE_MATRIX;
  }

  toString() {
    return `Mat4x4(${this.#type.toString()})`;
  }

  get byteSize() {
    return this.#type.byteSize * 16;
  }

  get alignment() {
    return this.#type.alignment;
  }

  count(view) {
    return view.byteLength / this.byteSize;
  }

  index(row, column) {
    return row * 4 + column;
  }

  offset(row, column) {
    return this.index(row, column) * this.#type.byteSize;
  }

  read(view, offset=0) {
    return [
      this.get(view, 0, 0, offset),
      this.get(view, 0, 1, offset),
      this.get(view, 0, 2, offset),
      this.get(view, 0, 3, offset),
      this.get(view, 1, 0, offset),
      this.get(view, 1, 1, offset),
      this.get(view, 1, 2, offset),
      this.get(view, 1, 3, offset),
      this.get(view, 2, 0, offset),
      this.get(view, 2, 1, offset),
      this.get(view, 2, 2, offset),
      this.get(view, 2, 3, offset),
      this.get(view, 3, 0, offset),
      this.get(view, 3, 1, offset),
      this.get(view, 3, 2, offset),
      this.get(view, 3, 3, offset),
    ];
  }

  write(view, value, offset=0) {
    this.set(view, value[0], 0, 0, offset);
    this.set(view, value[1], 0, 1, offset);
    this.set(view, value[2], 0, 2, offset);
    this.set(view, value[3], 0, 3, offset);
    this.set(view, value[4], 1, 0, offset);
    this.set(view, value[5], 1, 1, offset);
    this.set(view, value[6], 1, 2, offset);
    this.set(view, value[7], 1, 3, offset);
    this.set(view, value[8], 2, 0, offset);
    this.set(view, value[9], 2, 1, offset);
    this.set(view, value[10], 2, 2, offset);
    this.set(view, value[11], 2, 3, offset);
    this.set(view, value[12], 3, 0, offset);
    this.set(view, value[13], 3, 1, offset);
    this.set(view, value[14], 3, 2, offset);
    this.set(view, value[15], 3, 3, offset);
  }

  readAt(view, index, offset=0) {
    return read(view, index * this.byteSize + offset);
  }

  writeAt(view, index, value, offset=0) {
    write(view, value, index * this.byteSize + offset);
  }

  get(view, row, column, offset=0) {
    return this.#type.read(view, offset + this.offset(row, column));
  }

  set(view, value, row, column, offset=0) {
    this.#type.write(view, value, offset + this.offset(row, column));
  }

  view(buffer, offset=0, length=1) {
    return this.#type.view(buffer, offset, length * 16);
  }
}

// Vector types

export class Vec2 {
  #type;

  constructor(type) {
    assert(type.type === TYPE_PRIMITIVE, 'Vector type must be a primitive type');
    this.#type = type;
  }

  get type() {
    return TYPE_VECTOR;
  }

  toString() {
    return `Vec2(${this.#type.toString()})`;
  }

  get byteSize() {
    return this.#type.byteSize * 2;
  }

  get alignment() {
    return this.#type.alignment;
  }

  get offsetX() {
    return 0;
  }

  get offsetY() {
    return this.#type.byteSize;
  }

  count(view) {
    return view.byteLength / this.byteSize;
  }

  read(view, offset=0) {
    return [
      this.getX(view, offset),
      this.getY(view, offset),
    ];
  }

  write(view, value, offset=0) {
    this.setX(view, value[0], offset);
    this.setY(view, value[1], offset);
  }

  readAt(view, index, offset=0) {
    return read(view, index * this.byteSize + offset);
  }

  writeAt(view, index, value, offset=0) {
    write(view, value, index * this.byteSize + offset);
  }

  getX(view, offset=0) {
    return this.#type.read(view, offset + this.offsetX);
  }

  getY(view, offset=0) {
    return this.#type.read(view, offset + this.offsetY);
  }

  setX(view, value, offset=0) {
    this.#type.write(view, value, offset + this.offsetX);
  }

  setY(view, value, offset=0) {
    this.#type.write(view, value, offset + this.offsetY);
  }

  view(buffer, offset=0, length=1) {
    return this.#type.view(buffer, offset, length * 2);
  }
}

export class Vec3 {
  #type;

  constructor(type) {
    assert(type.type === TYPE_PRIMITIVE, 'Vector type must be a primitive type');
    this.#type = type;
  }

  get type() {
    return TYPE_VECTOR;
  }

  toString() {
    return `Vec3(${this.#type.toString()})`;
  }

  get byteSize() {
    return this.#type.byteSize * 3;
  }

  get alignment() {
    return this.#type.alignment;
  }

  get offsetX() {
    return 0;
  }

  get offsetY() {
    return this.#type.byteSize;
  }

  get offsetZ() {
    return this.#type.byteSize * 2;
  }

  count(view) {
    return view.byteLength / this.byteSize;
  }

  read(view, offset=0) {
    return [
      this.getX(view, offset),
      this.getY(view, offset),
      this.getZ(view, offset),
    ];
  }

  write(view, value, offset=0) {
    this.setX(view, value[0], offset);
    this.setY(view, value[1], offset);
    this.setZ(view, value[2], offset);
  }

  readAt(view, index, offset=0) {
    return read(view, index * this.byteSize + offset);
  }

  writeAt(view, index, value, offset=0) {
    write(view, value, index * this.byteSize + offset);
  }

  getX(view, offset=0) {
    return this.#type.read(view, offset + this.offsetX);
  }

  getY(view, offset=0) {
    return this.#type.read(view, offset + this.offsetY);
  }

  getZ(view, offset=0) {
    return this.#type.read(view, offset + this.offsetZ);
  }

  setX(view, value, offset=0) {
    this.#type.write(view, value, offset + this.offsetX);
  }

  setY(view, value, offset=0) {
    this.#type.write(view, value, offset + this.offsetY);
  }

  setZ(view, value, offset=0) {
    this.#type.write(view, value, offset + this.offsetZ);
  }

  view(buffer, offset=0, length=1) {
    return this.#type.view(buffer, offset, length * 3);
  }
}

export class Vec4 {
  #type;

  constructor(type) {
    assert(type.type === TYPE_PRIMITIVE, 'Vector type must be a primitive type');
    this.#type = type;
  }

  get type() {
    return TYPE_VECTOR;
  }

  toString() {
    return `Vec4(${this.#type.toString()})`;
  }

  get byteSize() {
    return this.#type.byteSize * 4;
  }

  get alignment() {
    return this.#type.alignment;
  }

  get offsetX() {
    return 0;
  }

  get offsetY() {
    return this.#type.byteSize;
  }

  get offsetZ() {
    return this.#type.byteSize * 2;
  }

  get offsetW() {
    return this.#type.byteSize * 3;
  }

  count(view) {
    return view.byteLength / this.byteSize;
  }

  read(view, offset=0) {
    return [
      this.getX(view, offset),
      this.getY(view, offset),
      this.getZ(view, offset),
      this.getW(view, offset),
    ];
  }

  write(view, value, offset=0) {
    this.setX(view, value[0], offset);
    this.setY(view, value[1], offset);
    this.setZ(view, value[2], offset);
    this.setW(view, value[3], offset);
  }

  readAt(view, index, offset=0) {
    return read(view, index * this.byteSize + offset);
  }

  writeAt(view, index, value, offset=0) {
    write(view, value, index * this.byteSize + offset);
  }

  getX(view, offset=0) {
    return this.#type.read(view, offset + this.offsetX);
  }

  getY(view, offset=0) {
    return this.#type.read(view, offset + this.offsetY);
  }

  getZ(view, offset=0) {
    return this.#type.read(view, offset + this.offsetZ);
  }

  getW(view, offset=0) {
    return this.#type.read(view, offset + this.offsetW);
  }

  setX(view, value, offset=0) {
    this.#type.write(view, value, offset + this.offsetX);
  }

  setY(view, value, offset=0) {
    this.#type.write(view, value, offset + this.offsetY);
  }

  setZ(view, value, offset=0) {
    this.#type.write(view, value, offset + this.offsetZ);
  }

  setW(view, value, offset=0) {
    this.#type.write(view, value, offset + this.offsetW);
  }

  view(buffer, offset=0, length=1) {
    return this.#type.view(buffer, offset, length * 4);
  }
}

// Primitive types

export class Float32 {
  static get type() {
    return TYPE_PRIMITIVE;
  }

  static toString() {
    return 'Float32';
  }

  static get byteSize() {
    return 4;
  }

  static get alignment() {
    return 4;
  }

  static count(view) {
    return view.byteLength / this.byteSize;
  }

  static read(view, offset=0) {
    return view.getFloat32(offset, true);
  }

  static write(view, value, offset=0) {
    view.setFloat32(offset, value, true);
  }

  static readAt(view, index, offset=0) {
    return view.getFloat32(index * this.byteSize + offset, true);
  }

  static writeAt(view, index, value, offset=0) {
    view.setFloat32(index * this.byteSize + offset, value, true);
  }

  static view(buffer, offset=0, length=1) {
    return new Float32Array(buffer, offset, length);
  }
}

export class Uint32 {
  static get type() {
    return TYPE_PRIMITIVE;
  }

  static toString() {
    return 'Uint32';
  }

  static get byteSize() {
    return 4;
  }

  static get alignment() {
    return 4;
  }

  static count(view) {
    return view.byteLength / this.byteSize;
  }

  static read(view, offset=0) {
    return view.getUint32(offset, true);
  }

  static write(view, value, offset=0) {
    view.setUint32(offset, value, true);
  }

  static readAt(view, index, offset=0) {
    return view.getUint32(index * this.byteSize + offset, true);
  }

  static writeAt(view, index, value, offset=0) {
    view.setUint32(index * this.byteSize + offset, value, true);
  }

  static view(buffer, offset=0, length=1) {
    return new Uint32Array(buffer, offset, length);
  }
}

export class Int32 {
  static get type() {
    return TYPE_PRIMITIVE;
  }

  static toString() {
    return 'Int32';
  }

  static get byteSize() {
    return 4;
  }

  static get alignment() {
    return 4;
  }

  static count(view) {
    return view.byteLength / this.byteSize;
  }

  static read(view, offset=0) {
    return view.getInt32(offset, true);
  }

  static write(view, value, offset=0) {
    view.setInt32(offset, value, true);
  }

  static readAt(view, index, offset=0) {
    return view.getInt32(index * this.byteSize + offset, true);
  }

  static writeAt(view, index, value, offset=0) {
    view.setInt32(index * this.byteSize + offset, value, true);
  }

  static view(buffer, offset=0, length=1) {
    return new Int32Array(buffer, offset, length);
  }
}

// Type helpers

export const Vec2F = new Vec2(Float32);
export const Vec3F = new Vec3(Float32);
export const Vec4F = new Vec4(Float32);
export const Mat2x2F = new Mat2x2(Float32);
export const Mat3x3F = new Mat3x3(Float32);
export const Mat4x4F = new Mat4x4(Float32);
