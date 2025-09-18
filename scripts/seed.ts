import { db } from '../src/server/db';
import { users, workspaces, folders, tables, columns, rows, cells } from '../src/server/db/schema';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');

    // Create sample users
    console.log('👤 Creating sample users...');
    const userResults = await db
      .insert(users)
      .values([
        {
          email: 'admin@example.com',
          name: 'Admin User',
        },
        {
          email: 'user@example.com',
          name: 'Regular User',
        },
      ])
      .returning({ id: users.id, name: users.name });

    const user1 = userResults[0]!;
    const user2 = userResults[1]!;
    console.log(`✅ Created users: ${user1.name}, ${user2.name}`);

    // Create sample workspaces
    console.log('🏢 Creating sample workspaces...');
    const workspaceResults = await db
      .insert(workspaces)
      .values([
        {
          name: 'My First Workspace',
          ownerUserId: user1.id,
        },
      ])
      .returning({ id: workspaces.id, name: workspaces.name });

    const workspace1 = workspaceResults[0]!;
    console.log(`✅ Created workspace: ${workspace1.name}`);

    // Create sample folders
    console.log('📁 Creating sample folders...');
    const folderResults = await db
      .insert(folders)
      .values([
        {
          name: 'Projects',
          workspaceId: workspace1.id,
          parentFolderId: null,
        },
      ])
      .returning({ id: folders.id, name: folders.name });

    const folder1 = folderResults[0]!;
    console.log(`✅ Created folder: ${folder1.name}`);

    // Create sample table
    console.log('📊 Creating sample table...');
    const tableResults = await db
      .insert(tables)
      .values([
        {
          name: 'Sample Data Table',
          folderId: folder1.id,
        },
      ])
      .returning({ id: tables.id, name: tables.name });

    const table1 = tableResults[0]!;
    console.log(`✅ Created table: ${table1.name}`);

    // Create sample columns
    console.log('📋 Creating sample columns...');
    const columnResults = await db
      .insert(columns)
      .values([
        {
          tableId: table1.id,
          name: 'Name',
          type: 'text',
          position: 1,
          configJson: JSON.stringify({ required: true }),
        },
        {
          tableId: table1.id,
          name: 'Age',
          type: 'number',
          position: 2,
          configJson: JSON.stringify({ min: 0, max: 120 }),
        },
        {
          tableId: table1.id,
          name: 'Email',
          type: 'email',
          position: 3,
          configJson: JSON.stringify({ required: true }),
        },
      ])
      .returning({ id: columns.id, name: columns.name });

    const col1 = columnResults[0]!;
    const col2 = columnResults[1]!;
    const col3 = columnResults[2]!;
    console.log(`✅ Created columns: ${col1.name}, ${col2.name}, ${col3.name}`);

    // Create sample rows
    console.log('📝 Creating sample rows...');
    const rowResults = await db
      .insert(rows)
      .values([
        {
          tableId: table1.id,
        },
        {
          tableId: table1.id,
        },
      ])
      .returning({ id: rows.id });

    const row1 = rowResults[0]!;
    const row2 = rowResults[1]!;
    console.log(`✅ Created ${rowResults.length} rows`);

    // Create sample cells
    console.log('🔢 Creating sample cells...');
    await db.insert(cells).values([
      // Row 1 data
      {
        rowId: row1.id,
        columnId: col1.id,
        valueJson: JSON.stringify('John Doe'),
      },
      {
        rowId: row1.id,
        columnId: col2.id,
        valueJson: JSON.stringify(30),
      },
      {
        rowId: row1.id,
        columnId: col3.id,
        valueJson: JSON.stringify('john@example.com'),
      },
      // Row 2 data
      {
        rowId: row2.id,
        columnId: col1.id,
        valueJson: JSON.stringify('Jane Smith'),
      },
      {
        rowId: row2.id,
        columnId: col2.id,
        valueJson: JSON.stringify(25),
      },
      {
        rowId: row2.id,
        columnId: col3.id,
        valueJson: JSON.stringify('jane@example.com'),
      },
    ]);

    console.log('✅ Created sample cell data');

    console.log('🎉 Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('🏁 Seeding process finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Unexpected error during seeding:', error);
      process.exit(1);
    });
}

export { seedDatabase };