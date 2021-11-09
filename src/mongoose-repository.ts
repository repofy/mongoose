import { Aggregate, Document, Model, Types } from 'mongoose'
import { LogicalOperatorMongooseEnum } from './filter/logical-operator-mongoose-enum'
import { ComparatorOperatorMongooseEnum } from './filter/comparator-operator-mongoose-enum'
import { ObjectId } from './object-id'
import {
  BaseEntity,
  Comparator,
  ComparatorOperatorEnum,
  Filter,
  InvalidIdError,
  LogicalOperatorEnum,
  MissingIdError,
  RegisterNotFoundError,
  Repository,
  RepositoryError,
  ResultPaged,
  Sort,
  ValidationError,
  VersionRepositoryError,
} from '@repofy/protocols'
import { DateUtil } from './util'

export abstract class MongooseRepository<
  T extends Document,
  V,
  U extends BaseEntity<V>,
> implements Repository<V, U>
{
  constructor(protected readonly doc: Model<T>) {}

  protected static prepareKeys(doc: any): any {
    if (!doc) {
      return null
    }

    const obj = JSON.parse(JSON.stringify(doc))

    for (const key of Object.keys(obj)) {
      if (key === 'id' && ObjectId.isValid(obj[key])) {
        obj._id = ObjectId.convert(obj[key])
        delete obj.id
      } else if (typeof obj[key] === 'object') {
        if (Array.isArray(obj[key])) {
          obj[key] = obj[key].map((o: any) => this.prepareKeys(o))
        } else {
          obj[key] = this.prepareKeys(obj[key])
        }
      }

      if (key.includes('.')) {
        obj[key.replace(/\./g, '-')] = obj[key]
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete obj[key]
      }
    }

    return obj
  }

  protected static populateOptions(list: string[]): any {
    const options: any = {
      path: list[0],
    }

    if (list.length > 1) {
      options.populate = MongooseRepository.populateOptions(list.slice(1))
    }

    return options
  }

  protected static convertStringToArray(populate: string | string[]): string[] {
    const list = []
    if (populate && Array.isArray(populate)) {
      list.push(...populate)
    } else if (populate && typeof populate === 'string') {
      list.push(populate)
    }
    return list
  }

  protected async preparePopulate(
    find: any,
    populate: string | string[],
  ): Promise<any> {
    const list = MongooseRepository.convertStringToArray(populate)

    for (const pop of list) {
      await find
        .populate(MongooseRepository.populateOptions(pop.split('.')))
        .clone()
    }

    return find.clone()
  }

  protected static convertObject(doc: any): any {
    if (!doc) {
      return null
    }

    if (typeof doc !== 'object' || DateUtil.isValid(doc)) {
      return doc
    } else if (ObjectId.isValid(doc)) {
      return ObjectId.format(doc)
    }

    const keys = Object.keys(doc)
    if (!keys.length) {
      return doc
    }

    const ret: any = {}
    for (const key of keys) {
      if (typeof doc[key] === 'object') {
        if (Array.isArray(doc[key])) {
          ret[key] = doc[key].map((o: any) =>
            MongooseRepository.convertObject(o),
          )
        } else if (ObjectId.isValid(doc[key])) {
          if (key === '_id') {
            ret.id = ObjectId.format(doc[key])
          } else {
            ret[key] = ObjectId.format(doc[key])
          }
        } else {
          ret[key] = MongooseRepository.convertObject(doc[key])
        }
      } else if (key === '__v') {
        ret.versao = Number(doc[key])
      } else {
        ret[key] = doc[key]
      }
    }

    return ret
  }

  protected static convertToIdOrFail(id: any): Types.ObjectId {
    if (!id) {
      throw new MissingIdError()
    }
    if (!ObjectId.isValid(id)) {
      throw new InvalidIdError()
    }
    return ObjectId.convert(id)
  }

  protected convertDocToObj(doc: T): U {
    if (!doc) {
      return null
    }
    return {
      ...MongooseRepository.convertObject(doc.toObject()),
    }
  }

  protected filterWithActive(filter?: any): any {
    if (!filter) {
      filter = {}
    }

    let and: any
    if (filter.$or) {
      and = [
        { $or: [...filter.$or] },
        {
          $or: [
            { [this.fieldActive()]: { $exists: false } },
            { [this.fieldActive()]: true },
          ],
        },
      ]
      delete filter.$or
    } else {
      filter.$or = [
        { [this.fieldActive()]: { $exists: false } },
        { [this.fieldActive()]: true },
      ]
    }

    if (filter.$and && and) {
      filter.$and = [...filter.$and, ...and]
    } else if (and) {
      filter.$and = and
    }

    return filter
  }

  protected comparatorToWhere(comparator: Comparator): any {
    switch (comparator.operator) {
      case ComparatorOperatorEnum.REGEX:
        return {
          [comparator.key]: {
            [ComparatorOperatorMongooseEnum.REGEX]: comparator.value,
            $options: comparator.options.regex,
          },
        }
      case ComparatorOperatorEnum.EQ_ID:
        return {
          [this.fieldId()]: {
            [ComparatorOperatorMongooseEnum.EQ]: ObjectId.convert(
              comparator.value,
            ),
          },
        }
      case ComparatorOperatorEnum.NEQ_ID:
        return {
          [this.fieldId()]: {
            [ComparatorOperatorMongooseEnum.NEQ]: ObjectId.convert(
              comparator.value,
            ),
          },
        }
      case ComparatorOperatorEnum.IN_ID:
        return {
          [this.fieldId()]: {
            [ComparatorOperatorMongooseEnum.IN]: comparator.value.map(
              (v: any) => ObjectId.convert(v),
            ),
          },
        }
      case ComparatorOperatorEnum.BETWEEN:
        return {
          [comparator.key]: {
            [ComparatorOperatorMongooseEnum.GTE]: comparator.getValueIndex(0),
            [ComparatorOperatorMongooseEnum.LTE]: comparator.getValueIndex(1),
          },
        }
      case ComparatorOperatorEnum.OP_AND:
        return {
          [LogicalOperatorMongooseEnum.AND]: comparator.values.map((c) =>
            this.comparatorToWhere(c),
          ),
        }
      case ComparatorOperatorEnum.OP_OR:
        return {
          [LogicalOperatorMongooseEnum.OR]: comparator.values.map((c) =>
            this.comparatorToWhere(c),
          ),
        }
      case ComparatorOperatorEnum.OP_NOR:
        return {
          [LogicalOperatorMongooseEnum.NOR]: comparator.values.map((c) =>
            this.comparatorToWhere(c),
          ),
        }
      case ComparatorOperatorEnum.OP_NOT:
        return {
          [LogicalOperatorMongooseEnum.NOT]: this.comparatorToWhere(
            comparator.value,
          ),
        }
      default:
        if (comparator.options?.convertToObjectId) {
          return {
            [comparator.key]: {
              [ComparatorOperatorMongooseEnum[comparator.operator]]: [
                ComparatorOperatorEnum.IN,
                ComparatorOperatorEnum.NIN,
              ].includes(comparator.operator)
                ? comparator.values?.map((v: any) => ObjectId.convert(v))
                : ObjectId.convert(comparator.value),
            },
          }
        } else {
          return {
            [comparator.key]: {
              [ComparatorOperatorMongooseEnum[comparator.operator]]: [
                ComparatorOperatorEnum.IN,
                ComparatorOperatorEnum.NIN,
              ].includes(comparator.operator)
                ? comparator.values
                : comparator.value,
            },
          }
        }
    }
  }

  protected comparatorToNative(comparator: Comparator | Comparator[]): any[] {
    const where: any[] = []
    if (comparator && Array.isArray(comparator)) {
      for (const comp of comparator) {
        if (Array.isArray(comp)) {
          where.push(this.comparatorToNative(comp))
        } else {
          where.push(this.comparatorToWhere(comp))
        }
      }
    } else if (comparator) {
      where.push(this.comparatorToWhere(comparator as Comparator))
    }
    return where
  }

  protected filterToNative(filter: Filter): any {
    const where: any = {}
    if (filter) {
      for (const command of filter.command) {
        const { operator, comparator } = command
        if (operator === LogicalOperatorEnum.NOT) {
          where[LogicalOperatorMongooseEnum[operator]] = Array.isArray(
            comparator,
          )
            ? this.comparatorToWhere(comparator[0])
            : this.comparatorToWhere(comparator)
        } else {
          const comparatorToNative = this.comparatorToNative(comparator)
          if (comparatorToNative?.length) {
            const key = LogicalOperatorMongooseEnum[operator]
            if (where[key]) {
              where[key] = [...where[key], ...comparatorToNative]
            } else {
              where[key] = comparatorToNative
            }
          }
        }
      }
    }
    return where
  }

  protected filterWithActiveToNative(filter: Filter, includeAll: boolean): any {
    let where = this.filterToNative(filter)
    if (!includeAll) {
      where = this.filterWithActive(where)
    }
    return where
  }

  protected static convertSortToNative(sort: Sort | Sort[]): any {
    const sortNative: any = {}
    if (sort && Array.isArray(sort)) {
      for (const s of sort) {
        sortNative[s.field] = s.direction
      }
    } else if (sort && 'field' in sort && 'direction' in sort) {
      sortNative[sort.field] = sort.direction
    }
    return sortNative
  }

  protected async findByIdNative(id: any): Promise<Document> {
    const objectId = MongooseRepository.convertToIdOrFail(id)
    try {
      return this.doc.findById(objectId)
    } catch (e) {
      throw new RepositoryError(
        'Erro ao obter registro por seu identificador: '.concat(e),
      )
    }
  }

  fieldId(): string {
    return '_id'
  }

  fieldVersion(): string {
    return '__v'
  }

  fieldUpdatedAt(): string {
    const timestamps = this.doc.schema.get('timestamps') as any
    if (!timestamps) {
      return null
    }
    return timestamps?.updatedAt
  }

  fieldCreatedAt(): string {
    const timestamps = this.doc.schema.get('timestamps') as any
    if (!timestamps) {
      return null
    }
    return timestamps?.createdAt
  }

  fieldActive(): string {
    return 'ativo'
  }

  async delete(id: V, includeAll = false): Promise<void> {
    const doc = await this.findByIdNative(id)

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (!includeAll && doc && doc.ativo === false) {
      throw new RegisterNotFoundError()
    }

    try {
      await doc.deleteOne()
    } catch (e) {
      throw new RepositoryError('Erro ao excluir registro: '.concat(e))
    }
  }

  async deleteMany(filter?: Filter, includeAll = false): Promise<void> {
    try {
      const where = this.filterWithActiveToNative(filter, includeAll)
      await this.doc.deleteMany(where)
    } catch (e) {
      throw new RepositoryError('Erro ao excluir vários registros: '.concat(e))
    }
  }

  async find(
    filter?: Filter,
    populate?: string | string[],
    sort?: Sort | Sort[],
    includeAll = false,
  ): Promise<U[]> {
    try {
      const sortNative = MongooseRepository.convertSortToNative(sort)

      const where = this.filterWithActiveToNative(filter, includeAll)

      const find = this.doc.find(where).sort(sortNative)

      const docs = await this.preparePopulate(find, populate)

      return (docs as any[]).map((doc) => this.convertDocToObj(doc))
    } catch (e) {
      throw new RepositoryError('Erro ao obter lista de registros: '.concat(e))
    }
  }

  async findById(
    id: V,
    populate?: string | string[],
    includeAll = false,
  ): Promise<U> {
    const objectId = MongooseRepository.convertToIdOrFail(id)
    try {
      const find = this.doc.findById(objectId)

      const doc = await this.preparePopulate(find, populate)

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (!includeAll && doc && doc.ativo === false) {
        return null
      }

      return this.convertDocToObj(doc)
    } catch (e) {
      throw new RepositoryError(
        'Erro ao obter registro por seu identificador: '.concat(e),
      )
    }
  }

  async findOne(
    filter?: Filter,
    populate?: string | string[],
    sort?: Sort | Sort[],
    includeAll = false,
  ): Promise<U> {
    try {
      const sortNative = MongooseRepository.convertSortToNative(sort)

      const where = this.filterWithActiveToNative(filter, includeAll)

      const find = this.doc.findOne(where).sort(sortNative)

      const doc = await this.preparePopulate(find, populate)

      return this.convertDocToObj(doc)
    } catch (e) {
      throw new RepositoryError('Erro ao obter um registro: '.concat(e))
    }
  }

  async paged(
    first = 0,
    pageSize = 10,
    filter?: Filter,
    populate?: string | string[],
    sort?: Sort | Sort[],
    includeAll = false,
  ): Promise<ResultPaged<U>> {
    try {
      const sortNative = MongooseRepository.convertSortToNative(sort)

      const where = this.filterWithActiveToNative(filter, includeAll)

      const find = this.doc
        .find(where)
        .sort(sortNative)
        .skip(first)
        .limit(pageSize)

      const docs = await this.preparePopulate(find, populate)

      const totalElements = await this.count(filter, includeAll)

      let page = 0
      if (!first || !pageSize) {
        page = Math.ceil(first / pageSize)
      }

      return {
        content: (docs as any[]).map((doc) => this.convertDocToObj(doc)),
        page,
        totalElements,
      }
    } catch (e) {
      throw new RepositoryError('Erro ao obter registros paginados: '.concat(e))
    }
  }

  async insert(doc: U, populate?: string | string[]): Promise<U> {
    try {
      delete doc.id
      delete doc.versao
      delete doc.dataAtualizacao
      delete doc.dataInclusao

      const obj = MongooseRepository.prepareKeys(doc)

      const list = MongooseRepository.convertStringToArray(populate)
      const populateMongoose: string[] = []
      for (const pop of list) {
        populateMongoose.push(
          MongooseRepository.populateOptions(pop.split('.')),
        )
      }

      const [docSaved] = (await this.doc.insertMany(obj, {
        populate: populateMongoose,
      })) as any

      return this.convertDocToObj(docSaved)
    } catch (e) {
      if (e?.name === 'ValidationError') {
        const errors: string[] = []
        Object.keys(e.errors).forEach((key) => {
          errors.push(e.errors[key].message)
        })
        throw new ValidationError(
          `Erro ao inserir documento: ${errors.join('. ')}`,
        )
      }
      throw new RepositoryError(
        `Erro ao inserir documento: ${
          e?.message ? e.message : 'erro não identificado'
        }`,
      )
    }
  }

  async insertMany(docs: U[], populate?: string | string[]): Promise<U[]> {
    try {
      docs.forEach((d) => delete d.id)
      const listDocs = docs.map((doc) => MongooseRepository.prepareKeys(doc))

      const list = (await this.doc.insertMany(listDocs)) as any

      const listRet: U[] = []
      if (populate) {
        for (const doc of list) {
          listRet.push(await this.findById(doc._id, populate))
        }
      } else {
        listRet.push(...list.map((l: T) => this.convertDocToObj(l)))
      }

      return listRet
    } catch (e) {
      throw new RepositoryError('Erro ao inserir vários registros: '.concat(e))
    }
  }

  async update(
    id: V,
    doc: U,
    populate?: string | string[],
    includeAll = false,
  ): Promise<U> {
    const docDb = await this.findByIdNative(id)

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (!docDb || (!includeAll && docDb.ativo === false)) {
      throw new RegisterNotFoundError()
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return this.updateDoc(doc, docDb, populate)
  }

  async exists(filter?: Filter, includeAll = false): Promise<boolean> {
    try {
      const where = this.filterWithActiveToNative(filter, includeAll)
      return this.doc.exists(where)
    } catch (e) {
      throw new RepositoryError(
        'Erro ao verificar se registro(s) existe(m): '.concat(e),
      )
    }
  }

  async upsert(
    doc: U,
    filter?: Filter,
    populate?: string | string[],
  ): Promise<U> {
    let docDb: T = null
    if (filter) {
      const where = this.filterToNative(filter)
      docDb = await this.doc.findOne(where)
    }

    if (docDb) {
      return this.updateDoc(doc, docDb, populate)
    } else {
      return this.insert(doc, populate)
    }
  }

  protected async updateDoc(
    doc: U,
    docDb: T,
    populate?: string | string[],
  ): Promise<U> {
    try {
      delete doc.dataAtualizacao
      delete doc.dataInclusao

      docDb._id = MongooseRepository.convertToIdOrFail(docDb.id)
      if (doc.versao != null) {
        docDb.__v = doc.versao
      }

      const obj = MongooseRepository.prepareKeys(doc)

      Object.keys(obj).forEach((k) => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        docDb.set(k, obj[k])
      })

      docDb.increment()

      const saved = await docDb.save()

      return this.findById(saved._id, populate)
    } catch (e) {
      if (e?.name === 'ValidationError') {
        const errors: string[] = []
        Object.keys(e.errors).forEach((key) => {
          errors.push(e.errors[key].message)
        })
        throw new ValidationError(
          `Erro ao atualizar documento: ${errors.join('. ')}`,
        )
      } else if (e?.name === 'VersionError') {
        throw new VersionRepositoryError(
          'Erro na versão do documento',
          e.message,
        )
      }
      throw new RepositoryError(
        `Erro ao atualizar documento: ${
          e?.message ? e.message : 'erro não identificado'
        }`,
      )
    }
  }

  async updateMany(
    filter: Filter,
    doc: U,
    populate?: string | string[],
    includeAll?: boolean,
  ): Promise<U[]> {
    const list = await this.find(filter, null, null, includeAll)
    const ret: U[] = []
    for (const docDb of list) {
      try {
        ret.push(await this.update(docDb.id, doc, populate, includeAll))
      } catch (e) {
        ret.push(docDb)
      }
    }
    return ret
  }

  async count(filter?: Filter, includeAll = false): Promise<number> {
    let aggregate: Aggregate<any>
    const where = this.filterWithActiveToNative(filter, includeAll)

    if (where) {
      aggregate = this.doc.aggregate([{ $match: where }])
    } else {
      aggregate = this.doc.aggregate()
    }

    const totalElements = await aggregate.count('count')

    return totalElements?.length ? totalElements[0].count : 0
  }

  async logicDelete(id: V): Promise<void> {
    const docDb = await this.findByIdNative(id)
    if (!docDb) {
      throw new RegisterNotFoundError()
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    docDb.ativo = false
    docDb.increment()

    await docDb.save()
  }

  async logicActive(id: V): Promise<void> {
    const docDb = await this.findByIdNative(id)
    if (!docDb) {
      throw new RegisterNotFoundError()
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    docDb.ativo = true
    docDb.increment()

    await docDb.save()
  }
}
