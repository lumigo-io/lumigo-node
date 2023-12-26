import { execSync } from 'child_process'

export default () => {
  // Clear previous test database and migrations used by Prisma
  execSync('rm -rf ./testUtils/prisma/migrations && rm -rf ./testUtils/prisma/dev.db')
  // Create a new database to be used by the Prisma tests
  execSync('npx prisma migrate dev --name init --schema ./testUtils/prisma/schema.prisma')
}