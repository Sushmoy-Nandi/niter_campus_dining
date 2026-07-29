import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log("Resetting passwords...")
  const adminPassword = await hash('Admin123!', 12)
  const studentPassword = await hash('Student123!', 12)
  
  await prisma.user.updateMany({
    where: { role: 'ADMIN' },
    data: { passwordHash: adminPassword }
  })
  
  await prisma.user.updateMany({
    where: { role: 'STUDENT' },
    data: { passwordHash: studentPassword }
  })

  console.log("Passwords reset successfully!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
