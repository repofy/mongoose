export const DateUtil = {
  isValid(value: any): boolean {
    if (!value) {
      return false
    }

    try {
      const data = new Date(value)
      return !isNaN(data?.getTime())
    } catch (e) {
      return false
    }
  },
}
