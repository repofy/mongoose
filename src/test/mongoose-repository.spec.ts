import TestRepository from './test-repository'
import Test2Repository from './test-2-repository'
import mongoose, { Mongoose } from 'mongoose'
import { Test } from './test'
import {
  Comparator,
  DirectionEnum,
  Filter,
  RegisterNotFoundError,
  Sort,
  ValidationError,
  VersionRepositoryError,
} from '@repofy/protocols'
import { ObjectId } from '../object-id'

describe('Mongoose Repository', () => {
  let connection: Mongoose
  let db: any
  const COLLECTION = 'tests'
  const docs: Test[] = [
    {
      nome: 'Teste 1',
      identificador: ObjectId.generate(),
      ordem: 1,
      data: new Date(),
      ativo: true,
    },
    {
      nome: 'Teste 2',
      identificador: ObjectId.generate(),
      ordem: 2,
      data: new Date(),
      ativo: true,
    },
    {
      nome: 'Teste 3',
      identificador: ObjectId.generate(),
      ordem: 3,
      data: new Date(),
      ativo: true,
    },
    {
      nome: 'Teste 4',
      identificador: ObjectId.generate(),
      ordem: 4,
      data: new Date(),
    },
    {
      nome: 'Teste 5',
      identificador: ObjectId.generate(),
      ordem: 5,
      data: new Date(),
      ativo: true,
    },
    {
      nome: 'Teste 6',
      identificador: ObjectId.generate(),
      ordem: 6,
      data: new Date(),
    },
    {
      nome: 'Teste 7',
      identificador: ObjectId.generate(),
      ordem: 7,
      data: new Date(),
      ativo: false,
    },
    {
      nome: 'Teste 8',
      identificador: ObjectId.generate(),
      ordem: 8,
      data: new Date(),
      ativo: false,
    },
  ]

  let docsSaved: Test[] = []
  let docsSavedWithoutAtivoFalse: Test[] = []

  beforeAll(async () => {
    connection = await mongoose.connect(process.env.MONGO_URL)
    db = connection.connection.db
  })

  beforeEach(async () => {
    const listInserted = await db.collection(COLLECTION).insertMany(
      docs.map((d) => {
        return {
          ...d,
          identificador: ObjectId.convert(d.identificador),
          __v: 0,
        }
      }),
    )
    for (let i = 0; i < docs.length; i++) {
      const doc: any = {
        id: listInserted.insertedIds[i].toHexString(),
        nome: docs[i].nome,
        identificador: docs[i].identificador,
        ordem: docs[i].ordem,
        data: docs[i].data,
        versao: 0,
      }
      if (docs[i].ativo !== undefined) {
        doc.ativo = docs[i].ativo
      }
      docsSaved.push(doc)
    }

    docsSavedWithoutAtivoFalse = docsSaved.filter(
      (d) => d.ativo === undefined || d.ativo,
    )
  })

  afterEach(async () => {
    docsSaved = []
    await db.collection(COLLECTION).deleteMany()
  })

  afterAll(async () => {
    await connection.disconnect()
    await mongoose.connection.close()
  })

  describe('find', () => {
    test('deve obter todos os registros ativos', async () => {
      const listFinds = await TestRepository.find()
      expect(listFinds).toStrictEqual(docsSavedWithoutAtivoFalse)
    })

    test('deve obter todos os registros', async () => {
      const listFinds = await TestRepository.find(
        null,
        null,
        null,
        null,
        null,
        true,
      )
      expect(listFinds).toStrictEqual(docsSaved)
    })

    test('deve retornar os registros esperados com base na operação OR', async () => {
      const registros = docsSaved.filter((d) => d.ordem === 1 || d.ordem === 4)

      const filter = new Filter().or([
        Comparator.eq('ordem', 1),
        Comparator.eq('ordem', 4),
      ])
      const lista = await TestRepository.find(filter)

      expect(lista).not.toBeNull()
      expect(lista).toStrictEqual(registros)
    })

    test('deve retornar os registro por data', async () => {
      const today = new Date()
      const start = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - 1,
      )
      const end = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + 1,
      )

      const filter = new Filter().and(Comparator.between('data', start, end))
      const list = await TestRepository.find(filter)

      expect(list?.length).toBe(docsSavedWithoutAtivoFalse.length)
    })

    test('deve retornar apenas os campos selecionados', async () => {
      const lista = await TestRepository.find(null, null, null, {
        ordem: true,
      })

      expect(lista).not.toBeNull()

      for (const item of lista) {
        expect(Object.keys(item)).toStrictEqual(['id', 'ordem'])
      }
    })

    test('deve retornar um número limite de itens', async () => {
      const lista = await TestRepository.find(null, null, null, null, 2)

      expect(lista).not.toBeNull()
      expect(lista.length).toBe(2)
    })
  })

  describe('findOne', () => {
    test('obter apenas um registro, filtrado pelo nome', async () => {
      const filter = new Filter().and(Comparator.eq('nome', 'Teste 1'))
      const obj = await TestRepository.findOne(filter)
      expect(obj).toStrictEqual(docsSaved[0])
    })

    test('deve retornar o primeiro item da lista seguindo a ordenação', async () => {
      const ultimo =
        docsSavedWithoutAtivoFalse[docsSavedWithoutAtivoFalse.length - 1]
      const sort: Sort = {
        field: 'ordem',
        direction: DirectionEnum.DESC,
      }
      const last = await TestRepository.findOne(null, null, sort)
      expect(last).toStrictEqual(ultimo)
    })
  })

  describe('findById', () => {
    test('obter um registro por id', async () => {
      const obj = await TestRepository.findById(docsSaved[0].id)
      expect(obj).toStrictEqual(docsSaved[0])
    })

    test('retornar null ao informar um id de registro que não exista', async () => {
      const obj = await TestRepository.findById(ObjectId.generate())
      expect(obj).toBeNull()
    })
  })

  describe('insert', () => {
    test('inserir um registro', async () => {
      const newDoc: Test = {
        nome: 'Teste Novo',
        identificador: ObjectId.generate(),
        ordem: 100,
        data: new Date(),
      }
      const newObj = await TestRepository.insert(newDoc)
      expect(newObj.nome).toBe(newDoc.nome)
      expect(new Date(newObj.data)).toStrictEqual(newDoc.data)
      expect(newObj.ordem).toBe(newDoc.ordem)
      expect(newObj.ativo).toBe(newDoc.ativo)
      expect(newObj.id).not.toBeUndefined()
      expect(newObj.id).not.toBeNull()
    })

    test('retornar exceção ao inserir registro inválido', async () => {
      const newDoc: Test = {
        nome: null,
        identificador: ObjectId.generate(),
        ordem: 0,
        data: new Date(),
      }
      await expect(TestRepository.insert(newDoc)).rejects.toEqual(
        new ValidationError('Erro ao inserir documento: Nome não informado'),
      )
    })

    test('deve salvar o registro reparando as keys que contém ponto', async () => {
      const obj: any = {
        key1: 1,
        'key.2': 'ponto',
        'ar.ray': [
          {
            key3: '3',
            'k.y': false,
          },
        ],
        obj: {
          innerObj: 'inner',
          'i..er.': new Date(),
        },
      }

      const inserted = await Test2Repository.insert(obj)
      expect(inserted).not.toBeNull()
      expect(inserted.key1).toBe(obj.key1)
      expect(inserted['key-2']).toBe(obj['key.2'])
      expect(inserted['ar-ray'][0].key3).toBe(obj['ar.ray'][0].key3)
      expect(inserted['ar-ray'][0]['k-y']).toBe(obj['ar.ray'][0]['k.y'])
      expect(inserted.obj.innerObj).toBe(obj.obj.innerObj)
      expect(inserted.obj['i--er-']).toStrictEqual(obj.obj['i..er.'])
    })

    test('deve popular o registro de referência', async () => {
      const obj: any = {
        key1: 1,
        test: docsSaved[1].id,
        test2: docsSaved[2].id,
      }

      const inserted = await Test2Repository.insert(obj, ['test', 'test2'])
      expect(inserted).not.toBeNull()
      expect(inserted.key1).toBe(obj.key1)
      expect(inserted.test).not.toBeNull()
      expect(inserted.test.id).toStrictEqual(docsSaved[1].id)
      expect(inserted.test.nome).toStrictEqual(docsSaved[1].nome)
      expect(inserted.test2).not.toBeNull()
      expect(inserted.test2.id).toStrictEqual(docsSaved[2].id)
      expect(inserted.test2.nome).toStrictEqual(docsSaved[2].nome)
    })

    test('não deve popular o registro de referência', async () => {
      const obj: any = {
        key1: 1,
        test: docsSaved[2].id,
      }

      const inserted = await Test2Repository.insert(obj)
      expect(inserted).not.toBeNull()
      expect(inserted.key1).toBe(obj.key1)
      expect(inserted.test).not.toBeNull()
      expect(inserted.test).toStrictEqual(docsSaved[2].id)
    })
  })

  describe('update', () => {
    test('atualizar um registro', async () => {
      const update = docsSaved[0]
      update.nome = 'Teste Alterado'
      const updated = await TestRepository.update(update.id, update)
      expect(updated.nome).toBe(update.nome)
      expect(new Date(updated.data)).toStrictEqual(update.data)
      expect(updated.ordem).toBe(update.ordem)
      expect(updated.id).toBe(update.id)
      expect(updated.ativo).toBe(update.ativo)
      expect(updated.versao).toBe(Number(update.versao) + 1)
    })

    test('retornar exceção ao atualizar registro com erro', async () => {
      const update = docsSaved[0]
      update.ordem = null
      await expect(TestRepository.update(update.id, update)).rejects.toEqual(
        new ValidationError('Erro ao atualizar documento: Ordem não informada'),
      )
    })

    test('deve validar versao do registro ao atualizar', async () => {
      const update = Object.assign({}, docsSaved[0])

      await TestRepository.update(update.id, {
        nome: 'Atualizado',
      })

      const updateRepository = TestRepository.update(update.id, {
        nome: 'Atualizado com versão',
        versao: update.versao,
      })

      await expect(updateRepository).rejects.toThrow(
        new VersionRepositoryError('Erro na versão do documento'),
      )
    })
  })

  describe('delete', () => {
    test('excluir registro por id', async () => {
      const deleted = docsSaved[0]
      await TestRepository.delete(deleted.id)
      const findDeleted = await TestRepository.findById(deleted.id)
      expect(findDeleted).toBeNull()
    })
  })

  describe('paged', () => {
    test('obter lista paginada dos registros', async () => {
      const sort: Sort = {
        field: 'ordem',
        direction: DirectionEnum.ASC,
      }
      const listPaged = await TestRepository.paged(0, 2, null, null, sort)
      expect(listPaged).not.toBeNull()
      expect(listPaged.content).toStrictEqual(docsSaved.slice(0, 2))
      expect(listPaged.content.length).toEqual(2)
      expect(listPaged.totalElements).toEqual(docsSavedWithoutAtivoFalse.length)
    })

    test('obter lista paginada dos registros passando o filter', async () => {
      const filter = new Filter().and(Comparator.lte('ordem', 2))
      const sort: Sort = {
        field: 'ordem',
        direction: DirectionEnum.ASC,
      }
      const listPaged = await TestRepository.paged(0, 2, filter, null, sort)
      expect(listPaged).not.toBeNull()
      expect(listPaged.content).toStrictEqual(docsSaved.slice(0, 2))
      expect(listPaged.content.length).toEqual(2)
      expect(listPaged.totalElements).toEqual(2)
    })
  })

  describe('exists', () => {
    test('deve retornar true para registro que exista', async () => {
      const filter = new Filter().and(Comparator.eq('nome', docsSaved[1].nome))
      const exits = await TestRepository.exists(filter)
      expect(exits).toBeTruthy()
    })

    test('deve retornar false para registro que não exista', async () => {
      const filter = new Filter().and(Comparator.eq('nome', 'Nome 999'))
      const exits = await TestRepository.exists(filter)
      expect(exits).toBeFalsy()
    })
  })

  describe('upsert', () => {
    test('deve inserir documento utilizando a função upsert', async () => {
      const filter = new Filter().and(Comparator.eq('ordem', 99))
      const doc: Test = {
        nome: 'Teste inserido',
        identificador: ObjectId.generate(),
        ordem: 99,
        data: new Date(),
      }
      const docSaved = await TestRepository.upsert(doc, filter)

      expect(docSaved.nome).toBe(doc.nome)
      expect(docSaved.ordem).toBe(doc.ordem)
      expect(docSaved.data).toStrictEqual(doc.data)
      expect(docSaved.id).not.toBeNull()
    })

    test('deve atualizar documento utilizando a função upsert', async () => {
      const doc: Test = Object.assign({}, docsSaved[1])
      doc.nome = 'Teste atualizado'
      doc.ordem = 88
      doc.data = new Date()

      const filter = new Filter().and(
        Comparator.eq(TestRepository.fieldId(), doc.id),
      )
      const docSaved = await TestRepository.upsert(doc, filter)

      expect(docSaved.nome).toBe(doc.nome)
      expect(docSaved.ordem).toBe(doc.ordem)
      expect(docSaved.data).toStrictEqual(doc.data)
      expect(docSaved.id).toBe(doc.id)
    })
  })

  describe('deleteMany', () => {
    test('excluir vários registros', async () => {
      const filter = new Filter().and(Comparator.regex('nome', 'Teste', 'i'))
      await TestRepository.deleteMany(filter)
      const list = await TestRepository.find()
      expect(list.length).toBe(0)
    })
  })

  describe('count', () => {
    test('count sem filtro', async () => {
      const count = await TestRepository.count()
      expect(count).toBe(docsSavedWithoutAtivoFalse.length)
    })

    test('count sem filtro, considerando todos os registros', async () => {
      const count = await TestRepository.count(null, true)
      expect(count).toBe(docs.length)
    })

    test('count com filtro', async () => {
      const filter = new Filter().and(Comparator.gt('ordem', 2))
      const count = await TestRepository.count(filter)
      expect(count).toBe(
        docsSavedWithoutAtivoFalse.filter((d) => d.ordem > 2).length,
      )
    })

    test('count com filtro, considerando todos os registros', async () => {
      const filter = new Filter().and(Comparator.gt('ordem', 2))
      const count = await TestRepository.count(filter, true)
      expect(count).toBe(docs.filter((d) => d.ordem > 2).length)
    })

    test('count com filtro in com conversão para o tipo ObjectId', async () => {
      const filter = new Filter().and(
        Comparator.in(
          'identificador',
          [docsSavedWithoutAtivoFalse[1].identificador],
          { convertToObjectId: true },
        ),
      )
      const count = await TestRepository.count(filter)
      expect(count).toBe(1)
    })
  })

  describe('logicDelete', () => {
    test('deve excluir logicamente informando id', async () => {
      await TestRepository.logicDelete(docsSaved[0].id)

      const docs = await TestRepository.find(null, null, null, null, null, true)
      for (const doc of docs) {
        if (doc.id === docsSaved[0].id) {
          expect(doc.ativo).toBeFalsy()
          expect(doc.versao).toBe(Number(docsSaved[0].versao) + 1)
        } else {
          const docSaved = docsSaved.find((d) => d.id === doc.id)
          expect(docSaved).not.toBeNull()
          expect(docSaved.ativo).toBe(doc.ativo)
        }
      }
    })

    test('não deve excluir logicamente se informado id no qual não pertece a nenhum registro', async () => {
      try {
        await TestRepository.logicDelete(ObjectId.generate())
      } catch (e) {
        expect(e).not.toBeNull()
        expect(e).toBeInstanceOf(RegisterNotFoundError)
        expect(e.message).toBe('Register not found')
      }
    })

    test('deve reativar um registro informando o id', async () => {
      const id = docsSaved[0].id
      await TestRepository.logicDelete(id)
      let doc = await TestRepository.findById(id, null, null, true)
      expect(doc).not.toBeNull()
      expect(doc.ativo).toBeFalsy()
      expect(doc.versao).toBe(Number(docsSaved[0].versao) + 1)

      await TestRepository.logicActive(id)
      doc = await TestRepository.findById(id)
      expect(doc).not.toBeNull()
      expect(doc.ativo).toBeTruthy()
      expect(doc.versao).toBe(Number(docsSaved[0].versao) + 2)
    })
  })

  describe('insertMany', () => {
    test('deve inserir vários registros', async () => {
      const list = await TestRepository.insertMany([
        {
          nome: 'Inserindo vários',
          identificador: ObjectId.generate(),
          ordem: 20,
          data: new Date(),
        },
        {
          nome: 'Teste vários 2',
          identificador: ObjectId.generate(),
          ordem: 21,
          data: new Date(),
        },
        {
          nome: 'Teste vários 3',
          identificador: ObjectId.generate(),
          ordem: 22,
          data: new Date(),
        },
      ])

      expect(list).not.toBeNull()
      expect(list.length).toBe(3)
    })
  })

  describe('updateMany', () => {
    test('deve atualizar vários documentos', async () => {
      const filter = new Filter().or([
        Comparator.eq('ordem', 1),
        Comparator.eq('ordem', 4),
      ])
      const updated = await TestRepository.updateMany(filter, {
        nome: 'Atualizado',
      })

      expect(updated).not.toBeNull()
      expect(updated?.length).toBe(2)
      for (const update of updated) {
        expect(update.nome).toBe('Atualizado')
      }
    })
  })

  describe('formatFilterToWhereNative', () => {
    test('deve retornar a query correta passando o filter', () => {
      const userId = ObjectId.generate()
      const empresaId = ObjectId.generate()
      const id = ObjectId.generate()
      const texto = 'campoTexto'
      const start = Math.random() * 100
      const end = start + Math.random() * 100

      const filter = new Filter()
        .and([
          Comparator.eq('user', userId, { convertToObjectId: true }),
          Comparator.eqId(id),
          Comparator.eq('texto', texto),
          Comparator.in('empresa', [empresaId], { convertToObjectId: true }),
        ])
        .or([
          Comparator.between('start', start, end),
          Comparator.between('end', start, end),
          Comparator.and([
            Comparator.lte('start', start),
            Comparator.gte('end', end),
          ]),
        ])

      const query = TestRepository.formatFilterToWhereNative(filter)

      expect(query).toStrictEqual({
        $and: [
          {
            user: {
              $eq: ObjectId.convert(userId),
            },
          },
          {
            _id: {
              $eq: ObjectId.convert(id),
            },
          },
          {
            texto: {
              $eq: texto,
            },
          },
          {
            empresa: {
              $in: [ObjectId.convert(empresaId)],
            },
          },
        ],
        $or: [
          {
            start: {
              $gte: start,
              $lte: end,
            },
          },
          {
            end: {
              $gte: start,
              $lte: end,
            },
          },
          {
            $and: [
              {
                start: {
                  $lte: start,
                },
              },
              {
                end: {
                  $gte: end,
                },
              },
            ],
          },
        ],
      })
    })

    test('deve retornar a query sem sobrescrever o operador $and', () => {
      const filter = new Filter()
        .and(Comparator.eq('campoAnd1', true))
        .and(Comparator.eq('campoAnd2', true))
        .and(Comparator.eq('campoAnd1', true))
        .or(Comparator.eq('campoOr1', true))
        .or(Comparator.eq('campoOr1', true))

      const query = TestRepository.formatFilterToWhereNative(filter)
      expect(query).toStrictEqual({
        $and: [
          {
            campoAnd1: { $eq: true },
          },
          {
            campoAnd2: { $eq: true },
          },
          {
            campoAnd1: { $eq: true },
          },
        ],
        $or: [
          {
            campoOr1: { $eq: true },
          },
          {
            campoOr1: { $eq: true },
          },
        ],
      })
    })
  })

  describe('fieldCreatedAt', () => {
    test('deve retornar createdAt definido', () => {
      expect(TestRepository.fieldCreatedAt()).toStrictEqual('dataInclusao')
    })
  })

  describe('fieldUpdatedAt', () => {
    test('deve retornar o updatedAt definido', () => {
      expect(TestRepository.fieldUpdatedAt()).toStrictEqual('dataAtualizacao')
    })
  })
})
