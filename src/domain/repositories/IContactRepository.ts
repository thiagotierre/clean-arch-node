import { Contact } from '../entities/Contact'

export interface IContactRepository {
  save(contact: Contact): Promise<void>
  findById(id: string): Promise<Contact | null>
  findByUserId(userId: string): Promise<Contact[]>
  delete(id: string): Promise<void>
}
