import { Types } from 'mongoose'

export const ObjectId = {
  format(value: any): string {
    return new Types.ObjectId(value).toHexString()
  },

  generate(): string {
    return new Types.ObjectId().toHexString()
  },

  isValid(value: any): boolean {
    return Types.ObjectId.isValid(value)
  },

  convert(value: any): Types.ObjectId {
    return new Types.ObjectId(value)
  },
}
