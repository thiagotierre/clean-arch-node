import { Contact, ContactProps } from '../../domain/entities/Contact'
import { ContactResponseDTO } from '../../application/dtos/ContactDTO'

export interface ContactDynamoItem {
  PK: string
  SK: string
  id: string
  name: string
  email: string
  phone?: string
  userId: string
  createdAt: string
  updatedAt: string
  entityType: 'CONTACT'
}

export class ContactMapper {
  static toResponseDTO(contact: Contact): ContactResponseDTO {
    return {
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      userId: contact.userId,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
    }
  }

  static toDynamoItem(contact: Contact): ContactDynamoItem {
    return {
      PK: `USER#${contact.userId}`,
      SK: `CONTACT#${contact.id}`,
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      userId: contact.userId,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
      entityType: 'CONTACT',
    }
  }

  static fromDynamoItem(item: ContactDynamoItem): Contact {
    const props: ContactProps = {
      id: item.id,
      name: item.name,
      email: item.email,
      phone: item.phone,
      userId: item.userId,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
    }

    return Contact.reconstitute(props)
  }
}
