import { DiaryError } from './DiaryError'

/** A validated calendar date, also used as a safe diary file identifier. */
export class DiaryDate {
  readonly #value: string

  private constructor(value: string) {
    this.#value = value
    Object.freeze(this)
  }

  static parse(value: string): DiaryDate {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (!match) throw new DiaryError('invalid_date', `Invalid diary date: ${value}`)
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]!) {
      throw new DiaryError('invalid_date', `Invalid diary date: ${value}`)
    }
    return new DiaryDate(value)
  }

  toString(): string {
    return this.#value
  }

  toJSON(): string {
    return this.#value
  }

  equals(other: DiaryDate): boolean {
    return this.#value === other.#value
  }

  get year(): string {
    return this.#value.slice(0, 4)
  }

  get fileName(): string {
    return `${this.#value}.md`
  }

  compare(other: DiaryDate): number {
    return this.#value < other.#value ? -1 : this.#value > other.#value ? 1 : 0
  }
}
