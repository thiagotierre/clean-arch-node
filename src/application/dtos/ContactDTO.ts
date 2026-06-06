export interface CreateContactDTO {
  name: string
  email: string
  phone?: string
  userId: string
}

export interface UpdateContactDTO {
  id: string
  userId: string
  name?: string
  email?: string
  phone?: string
}

export interface ContactResponseDTO {
  id: string
  name: string
  email: string
  phone?: string
  userId: string
  createdAt: string
  updatedAt: string
}
