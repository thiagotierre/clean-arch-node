import { Contact } from '../../../domain/entities/Contact'
import { IContactRepository } from '../../../domain/repositories/IContactRepository'
import { CreateContactDTO, ContactResponseDTO } from '../../dtos/ContactDTO'
import { ContactMapper } from '../../../interfaces/mappers/ContactMapper'

export class CreateContactUseCase {
  constructor(private readonly contactRepository: IContactRepository) {}

  async execute(dto: CreateContactDTO): Promise<ContactResponseDTO> {
    const contact = Contact.create({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      userId: dto.userId,
    })

    await this.contactRepository.save(contact)

    return ContactMapper.toResponseDTO(contact)
  }
}
