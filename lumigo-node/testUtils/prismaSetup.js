import { execSync } from 'child_process'
import path from 'path'

const withPrismaFixturesPath = (...paths) => path.resolve(__dirname, 'prisma', ...paths)

export default () => {
  // Clear previous test database and migrations used by Prisma
  execSync(`rm -rf ${withPrismaFixturesPath('migrations')} && rm -rf ${withPrismaFixturesPath('dev.db')}`)
  // Create a new database to be used by the Prisma tests
  execSync(`npx prisma migrate dev --name init --schema ${withPrismaFixturesPath('schema.prisma')}`)
}