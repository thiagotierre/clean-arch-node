import { IContactRepository } from '../../../domain/repositories/IContactRepository'
import { ContactResponseDTO } from '../../dtos/ContactDTO'
import { ContactMapper } from '../../../interfaces/mappers/ContactMapper'

export class GetContactUseCase {
  constructor(private readonly contactRepository: IContactRepository) {}

  async execute(id: string, userId: string): Promise<ContactResponseDTO> {
    const contact = await this.contactRepository.findById(id)

    if (!contact || contact.userId !== userId) {
      throw new Error('Contact not found')
    }

    return ContactMapper.toResponseDTO(contact)
  }
}
