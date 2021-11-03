import { Repository } from '@repofy/protocols'
import { MongooseRepository } from '../mongoose-repository'
import { Document, model, Schema, Types } from 'mongoose'
import { Test2 } from './test-2'
import { timestampsPtBR } from '../options'

const testSchema = new Schema(
  {
    key1: Number,
    'key-2': String,
    'ar-ray': [
      new Schema({
        key3: String,
        'k-y': Boolean,
      }),
    ],
    obj: new Schema({
      innerObj: String,
      'i--er-': Date,
    }),
    test: {
      type: Types.ObjectId,
      ref: 'test',
    },
  },
  {
    timestamps: timestampsPtBR,
  },
)

interface Test2Document extends Document, Test2 {
  id?: string
}

class Test2Repository
  extends MongooseRepository<Test2Document, string, Test2>
  implements Repository<string, Test2> {}

export default new Test2Repository(
  model<Test2Document>('test2', testSchema, 'tests2'),
)
