import { ObjectId } from './object-id'

describe('ObjectId', () => {
  it('deve validar object id válido', () => {
    const id = '5f56390dfb609cba1a53ace2'
    const isValid = ObjectId.isValid(id)
    expect(isValid).toBeTruthy()
  })

  it('deve invalidar object id inválido', () => {
    const id = ''
    const isValid = ObjectId.isValid(id)
    expect(isValid).toBeFalsy()

    const isValid2 = ObjectId.isValid(null)
    expect(isValid2).toBeFalsy()
  })

  it('deve gerar um object id válido', () => {
    const id = ObjectId.generate()
    expect(id).not.toBeNull()

    const isValid = ObjectId.isValid(id)
    expect(isValid).toBeTruthy()
  })

  it('converter string para o tipo ObjectId', () => {
    const id = '5f56390dfb609cba1a53ace2'
    const objId = ObjectId.convert(id)
    expect(objId).not.toBeNull()

    const isValid = ObjectId.isValid(objId)
    expect(isValid).toBeTruthy()
  })
})
