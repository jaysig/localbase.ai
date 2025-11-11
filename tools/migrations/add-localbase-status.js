#!/usr/bin/env node

/**
 * Migration: Add localbase_status field to customer_relationships
 *
 * Adds normalized status field and backfills existing data with mapping
 * from raw source statuses (HubSpot, etc.) to LocalBase pipeline statuses.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// LocalBase status flow (9 stages)
const LOCALBASE_STATUSES = [
  'New',
  'Contacted',
  'Appointment Set',
  'Proposal Sent',
  'Proposal Signed',
  'Job Scheduled',
  'Job Complete',
  'Invoice Sent',
  'Payment Complete'
];

// Mapping from source statuses (HubSpot/RoofMaxx) to LocalBase statuses
const STATUS_MAP = {
  // Raw HubSpot stage IDs
  '962654': 'New',
  '962623': 'Contacted',
  '962653': 'Appointment Set',
  '81330015': 'Proposal Sent',
  '2169759': 'Proposal Signed',
  '962624': 'Job Complete', // Lost - map to complete for now

  // HubSpot stage labels
  'New': 'New',
  'New OMNI Lead': 'New',
  'Contacted': 'Contacted',
  'Appointment Set': 'Appointment Set',
  'Proposal Sent': 'Proposal Sent',
  'Proposal Signed': 'Proposal Signed',
  'Job Offer Accepted': 'Job Scheduled',
  'Sent to Dispatch': 'Job Scheduled',
  'Job Paused': 'Job Scheduled',
  'Job 100% Complete': 'Job Complete',
  'Complete': 'Job Complete',
  'Invoice Sent': 'Invoice Sent',
  'Payment Complete': 'Payment Complete',

  // Edge cases
  'Lost': 'Job Complete', // Or create separate "Lost" status?
  'Duplicate Consumer Lead': 'New',
  'Hold (No dealer in area, Quality issue, etc)': 'New',
  'Testing': 'New',
};

function migrate(dbPath) {
  console.log(`🔧 Migrating database: ${dbPath}`);

  const db = new Database(dbPath);

  // 1. Add column if it doesn't exist
  try {
    db.exec(`
      ALTER TABLE customer_relationships
      ADD COLUMN localbase_status TEXT
    `);
    console.log('✅ Added localbase_status column');
  } catch (err) {
    if (err.message.includes('duplicate column')) {
      console.log('ℹ️  Column already exists, skipping...');
    } else {
      throw err;
    }
  }

  // 2. Backfill existing records
  console.log('\n📊 Backfilling existing records...');

  const records = db.prepare(`
    SELECT id, status, relationship_type
    FROM customer_relationships
    WHERE relationship_type = 'lead' AND status IS NOT NULL
  `).all();

  console.log(`Found ${records.length} leads to update`);

  const updateStmt = db.prepare(`
    UPDATE customer_relationships
    SET localbase_status = ?
    WHERE id = ?
  `);

  let updated = 0;
  let unmapped = new Set();

  for (const record of records) {
    const localbaseStatus = STATUS_MAP[record.status] || 'New';

    if (!STATUS_MAP[record.status]) {
      unmapped.add(record.status);
    }

    updateStmt.run(localbaseStatus, record.id);
    updated++;
  }

  console.log(`✅ Updated ${updated} records`);

  if (unmapped.size > 0) {
    console.log('\n⚠️  Unmapped statuses (defaulted to "New"):');
    unmapped.forEach(status => console.log(`   - "${status}"`));
  }

  // 3. Show distribution
  console.log('\n📈 Status distribution:');
  const distribution = db.prepare(`
    SELECT localbase_status, COUNT(*) as count
    FROM customer_relationships
    WHERE relationship_type = 'lead'
    GROUP BY localbase_status
    ORDER BY count DESC
  `).all();

  distribution.forEach(row => {
    console.log(`   ${row.localbase_status || '(null)'}: ${row.count}`);
  });

  db.close();
  console.log('\n✅ Migration complete!');
}

// Run migration
const dbPath = process.argv[2] || path.join(process.cwd(), 'data', 'localbase.db');

if (!dbPath) {
  console.error('Usage: node add-localbase-status.js [path/to/localbase.db]');
  process.exit(1);
}

migrate(dbPath);
