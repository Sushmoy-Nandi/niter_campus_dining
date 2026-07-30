import { PrismaClient } from "@prisma/client"
import { hash } from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding database...")

  const adminPassword = await hash("Admin123!", 12)
  const studentPassword = await hash("Student123!", 12)

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@gmail.com" },
    update: {},
    create: {
      email: "admin@gmail.com",
      name: "Admin",
      passwordHash: adminPassword,
      role: "ADMIN",
    },
  })

  await prisma.admin.upsert({
    where: { email: "admin@niter.edu.bd" },
    update: {},
    create: {
      name: "System Admin",
      email: "admin@niter.edu.bd",
      userId: adminUser.id,
    },
  })

  await prisma.mealRate.create({
    data: {
      lunchPrice: 60,
      dinnerPrice: 50,
    },
  })

  /*
  const students = [
    { studentId: "221-15-5001", name: "Md. Rahman", department: "Textile Engineering", session: "2019-20" },
    { studentId: "221-15-5002", name: "Fatima Akter", department: "Computer Science", session: "2019-20" },
    { studentId: "221-15-5003", name: "Tanvir Hasan", department: "Electrical Engineering", session: "2019-20" },
  ]

  for (const student of students) {
    const user = await prisma.user.upsert({
      where: { email: `${student.studentId}@niter.edu.bd` },
      update: {},
      create: {
        email: `${student.studentId}@niter.edu.bd`,
        name: student.name,
        passwordHash: studentPassword,
        role: "STUDENT",
      },
    })

    const createdStudent = await prisma.student.upsert({
      where: { studentId: student.studentId },
      update: {},
      create: {
        studentId: student.studentId,
        name: student.name,
        email: `${student.studentId}@niter.edu.bd`,
        department: student.department,
        session: student.session,
        userId: user.id,
      },
    })

    await prisma.wallet.upsert({
      where: { studentId: createdStudent.id },
      update: {},
      create: {
        studentId: createdStudent.id,
        balance: 1500,
      },
    })

    await prisma.transaction.create({
      data: {
        studentId: createdStudent.id,
        type: "DEPOSIT",
        amount: 1500,
        description: "Initial deposit",
      },
    })
  }
  */

  console.log("Seeding completed!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
