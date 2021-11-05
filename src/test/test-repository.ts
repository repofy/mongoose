import { Filter, Repository } from '@repofy/protocols'
import { MongooseRepository } from '../mongoose-repository'
import { Document, model, Schema, Types } from 'mongoose'
import { Test } from './test'
import { timestampsPtBR } from '../options'

const testSchema = new Schema(
  {
    nome: {
      type: String,
      required: [true, 'Nome não informado'],
    },
    identificador: {
      type: Types.ObjectId,
      required: [true, 'Identificador não informado'],
    },
    ordem: {
      type: Number,
      required: [true, 'Ordem não informada'],
    },
    data: {
      type: Date,
      required: [true, 'Data não informada'],
    },
    ativo: {
      type: Boolean,
      defaultValue: true,
    },
  },
  { timestamps: timestampsPtBR },
)

interface TestDocument extends Document, Test {
  id?: string
}

class TestRepository
  extends MongooseRepository<TestDocument, string, Test>
  implements Repository<string, Test>
{
  formatFilterToWhereNative(filter: Filter): any {
    return this.filterToNative(filter)
  }
}

export default new TestRepository(
  model<TestDocument>('test', testSchema, 'tests', true),
)
