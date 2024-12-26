// Source: GitHub Copilot

/**
 * @implements {ArrayBufferView}
 */
export class Float16Array {
  /**
   * @readonly
   */
  static BYTES_PER_ELEMENT = 2;

  /**
   * @type {DataView}
   */
  #view;

  /**
   * @type {number}
   */
  #byteOffset;

  /**
   * @type {number}
   */
  #length;

  /**
   * @param {ArrayBuffer} buffer
   * @param {number} [byteOffset=0]
   * @param {number} [length=1]
   */
  constructor(buffer, byteOffset = 0, length = 1) {
    this.#view = new DataView(buffer, byteOffset, length * 2);
    this.#byteOffset = byteOffset;
    this.#length = length;

    return new Proxy(this, {
      get(target, prop) {
        if (typeof prop === 'string' && !isNaN(Number(prop))) {
          return target.#get(Number(prop));
        }
        return (/** @type {any} */ (target))[prop];
      },
      set(target, prop, value) {
        if (typeof prop === 'string' && !isNaN(Number(prop))) {
          target.#set(Number(prop), value);
        }
        return true;
      },
    });
  }

  get buffer() {
    return this.#view.buffer;
  }

  get byteLength() {
    return this.#view.byteLength;
  }

  get byteOffset() {
    return this.#view.byteOffset;
  }

  /**
   * @param {number} index
   * @returns {number}
   */
  #get(index) {
    return getFloat16(this.#view, index * 2, true);
  }

  /**
   * @param {number} index
   * @param {number} value
   */
  #set(index, value) {
    setFloat16(this.#view, index * 2, value, true);
  }
}

/**
 * @param {DataView} view
 * @param {number} byteOffset
 * @param {boolean} littleEndian
 * @returns {number}
 */
export function getFloat16(view, byteOffset, littleEndian) {
  const value = view.getUint16(byteOffset, littleEndian);
  const sign = value & 0x8000;
  const exponent = (value & 0x7C00) >> 10;
  const fraction = value & 0x03FF;
  if (exponent === 0) {
    return sign ? -0 : 0;
  }
  if (exponent === 0x1F) {
    return fraction ? NaN : sign ? -Infinity : Infinity;
  }
  return (sign ? -1 : 1) * (2 ** (exponent - 15)) * (1 + fraction / 0x400);
}

/**
 * @param {DataView} view
 * @param {number} byteOffset
 * @param {number} value
 * @param {boolean} littleEndian
 */
export function setFloat16(view, byteOffset, value, littleEndian) {
  let sign = 0;
  let exponent = 0;
  let fraction = 0;
  if (isNaN(value)) {
    sign = 0;
    exponent = 0x1F;
    fraction = 1;
  } else if (value === Infinity) {
    sign = 0;
    exponent = 0x1F;
    fraction = 0;
  } else if (value === -Infinity) {
    sign = 1;
    exponent = 0x1F;
    fraction = 0;
  } else if (value === 0) {
    sign = 1 / value === -Infinity ? 1 : 0;
    exponent = 0;
    fraction = 0;
  } else {
    sign = value < 0 ? 1 : 0;
    const absValue = Math.abs(value);
    const log2 = Math.floor(Math.log2(absValue));
    exponent = log2 + 15;
    fraction = (absValue / (2 ** log2) - 1) * 0x400;
  }
  const result = (sign << 15) | (exponent << 10) | fraction;
  view.setUint16(byteOffset, result, littleEndian);
}
