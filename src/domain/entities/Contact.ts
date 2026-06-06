import { randomUUID } from 'crypto'

export interface ContactProps {
  id: string
  name: string
  email: string
  phone?: string
  userId: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateContactProps {
  name: string
  email: string
  phone?: string
  userId: string
}

export class Contact {
  private readonly _props: ContactProps

  private constructor(props: ContactProps) {
    this._props = props
  }

  static create(props: CreateContactProps): Contact {
    return new Contact({
      id: randomUUID(),
      name: props.name,
      email: props.email,
      phone: props.phone,
      userId: props.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  static reconstitute(props: ContactProps): Contact {
    return new Contact(props)
  }

  updateDetails(name: string, email: string, phone?: string): void {
    this._props.name = name
    this._props.email = email
    this._props.phone = phone
    this._props.updatedAt = new Date()
  }

  get id(): string { return this._props.id }
  get name(): string { return this._props.name }
  get email(): string { return this._props.email }
  get phone(): string | undefined { return this._props.phone }
  get userId(): string { return this._props.userId }
  get createdAt(): Date { return this._props.createdAt }
  get updatedAt(): Date { return this._props.updatedAt }
}
