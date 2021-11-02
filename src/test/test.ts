import { BaseEntity } from '@repofy/protocols'

export interface Test extends BaseEntity<string> {
  nome?: string
  identificador?: string
  ordem?: number
  data?: Date
}
