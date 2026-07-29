import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting full reset to leave only fresh admin...')

  // Delete all users who are NOT ADMIN
  // This will cascade delete Students, Staff, Wallets, Transactions, MealSchedules, etc.
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      role: {
        not: 'ADMIN',
      },
    },
  })
  
  console.log(`Deleted ${deletedUsers.count} non-admin users and all their associated data (Students, Wallets, Transactions, etc.).`)

  // Also clean up any loose ends if they exist (Bazaar, DiningPeriods, Polls)
  await prisma.bazaar.deleteMany({})
  await prisma.diningPeriod.deleteMany({})
  await prisma.poll.deleteMany({})
  
  console.log('Database is now completely fresh! Only the Admin remains.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
