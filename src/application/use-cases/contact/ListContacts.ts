import { IContactRepository } from '../../../domain/repositories/IContactRepository'
import { ContactResponseDTO } from '../../dtos/ContactDTO'
import { ContactMapper } from '../../../interfaces/mappers/ContactMapper'

export class ListContactsUseCase {
  constructor(private readonly contactRepository: IContactRepository) {}

  async execute(userId: string): Promise<ContactResponseDTO[]> {
    const contacts = await this.contactRepository.findByUserId(userId)
    return contacts.map(ContactMapper.toResponseDTO)
  }
}
