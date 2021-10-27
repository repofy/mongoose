export const timestampsPtBR: TimestampConfig = {
  createdAt: 'dataInclusao',
  updatedAt: 'dataAtualizacao',
}
export const timestampsEn: TimestampConfig = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
}

export class TimestampConfig {
  createdAt: string
  updatedAt: string
}
