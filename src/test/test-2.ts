import { BaseEntity } from '@repofy/protocols'
import { Test } from './test'

export interface Test2Array {
  key3: number
  'k-y': boolean
}

export interface Test2Inner {
  innerObj: string
  'i--er-': boolean
}

export interface Test2 extends BaseEntity<string> {
  key1?: number
  'key-2'?: string
  'ar-ray'?: Test2Array[]
  obj?: Test2Inner
  test?: Test
  test2?: Test
}
