import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting transaction cleanup...')

  // Delete all transactions
  const deletedTransactions = await prisma.transaction.deleteMany({})
  console.log(`Deleted ${deletedTransactions.count} transactions.`)

  // Delete all deposit approvals (if any)
  const deletedApprovals = await prisma.depositApproval.deleteMany({})
  console.log(`Deleted ${deletedApprovals.count} deposit approvals.`)

  // Delete all daily charges (since they are related to transactions)
  const deletedCharges = await prisma.dailyCharge.deleteMany({})
  console.log(`Deleted ${deletedCharges.count} daily charges.`)

  // Reset all wallet balances to 0
  const resetWallets = await prisma.wallet.updateMany({
    data: {
      balance: 0,
    },
  })
  console.log(`Reset ${resetWallets.count} wallet balances to 0.`)

  console.log('Cleanup completed successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
