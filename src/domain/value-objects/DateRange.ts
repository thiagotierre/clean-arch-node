export class DateRange {
  private constructor(
    private readonly _startDate: Date,
    private readonly _endDate: Date,
  ) {}

  static create(startDate: Date, endDate: Date): DateRange {
    if (startDate >= endDate) {
      throw new Error('Start date must be before end date')
    }
    if (startDate < new Date()) {
      throw new Error('Start date cannot be in the past')
    }
    return new DateRange(startDate, endDate)
  }

  static reconstitute(startDate: Date, endDate: Date): DateRange {
    return new DateRange(startDate, endDate)
  }

  get startDate(): Date { return this._startDate }
  get endDate(): Date { return this._endDate }

  durationInMinutes(): number {
    return (this._endDate.getTime() - this._startDate.getTime()) / 60_000
  }

  overlaps(other: DateRange): boolean {
    return this._startDate < other.endDate && this._endDate > other.startDate
  }
}
