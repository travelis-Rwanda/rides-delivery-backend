/**
 * Initial database setup migration
 * Creates the deliveries table with all constraints and indexes
 */

exports.up = async function(knex) {
  // Create deliveries table
  await knex.schema.createTable('deliveries', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    
    // User references (from Rides Platform)
    table.uuid('customer_id').notNullable().comment('Customer ID from Rides Platform');
    
    // Location data (JSONB for flexibility)
    table.jsonb('pickup_location').notNullable().comment('Pickup location with latitude, longitude, address');
    table.jsonb('destination_location').notNullable().comment('Destination location with latitude, longitude, address');
    
    // Delivery information
    table.string('delivery_category', 20).notNullable()
      .comment('Type of delivery: Parcel, Restaurant, Shop, or Cargo');
    table.text('item_description').notNullable().comment('Description of items being delivered');
    
    // Contact information
    table.string('customer_phone', 15).notNullable().comment('Customer phone number (+250XXXXXXXXX)');
    table.string('recipient_phone', 15).notNullable().comment('Recipient phone number (+250XXXXXXXXX)');
    table.string('recipient_name', 255).notNullable().comment('Recipient name');
    
    // Status tracking
    table.string('status', 30).notNullable().comment('Current delivery status');
    
    // Calculated fields
    table.decimal('estimated_distance', 10, 2).comment('Estimated distance in kilometers');
    
    // Category-specific attributes
    table.jsonb('category_attributes').comment('Category-specific data (size, temperature, etc.)');
    
    // Module integration
    table.string('source_module', 50).comment('Source module: Restaurant, Shop, CollectionPoint, or NULL');
    table.uuid('source_order_id').comment('Reference to order ID in source module');
    
    // Timestamps
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    
    // Check constraints
    table.check(
      "delivery_category IN ('Parcel', 'Restaurant', 'Shop', 'Cargo')",
      [],
      'chk_delivery_category'
    );
    
    table.check(
      `status IN (
        'open', 'negotiating', 'confirmed', 'rejected', 'in_progress',
        'failed', 'completed', 'returning', 'returned',
        'cancelled', 'refund_requested', 'refund_processed', 'disputed'
      )`,
      [],
      'chk_status'
    );
    
    table.check(
      "customer_phone ~ '^\\+250[0-9]{9}$'",
      [],
      'chk_customer_phone_format'
    );
    
    table.check(
      "recipient_phone ~ '^\\+250[0-9]{9}$'",
      [],
      'chk_recipient_phone_format'
    );
    
    table.check(
      `(pickup_location->>'latitude')::DECIMAL BETWEEN -90 AND 90 AND
       (pickup_location->>'longitude')::DECIMAL BETWEEN -180 AND 180 AND
       (destination_location->>'latitude')::DECIMAL BETWEEN -90 AND 90 AND
       (destination_location->>'longitude')::DECIMAL BETWEEN -180 AND 180`,
      [],
      'chk_valid_coordinates'
    );
  });
  
  // Create indexes for efficient querying
  await knex.schema.table('deliveries', (table) => {
    table.index('customer_id', 'idx_deliveries_customer');
    table.index('status', 'idx_deliveries_status');
    table.index('delivery_category', 'idx_deliveries_category');
    table.index(['created_at'], 'idx_deliveries_created_at');
  });
  
  console.log('✓ Created deliveries table with constraints and indexes');
  
  // Create price_offers table
  await knex.schema.createTable('price_offers', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    
    // Foreign keys
    table.uuid('delivery_id').notNullable()
      .references('id').inTable('deliveries').onDelete('CASCADE')
      .comment('Reference to delivery request');
    table.uuid('driver_id').notNullable().comment('Driver ID from Rides Platform');
    
    // Offer details
    table.integer('price_amount').notNullable().comment('Proposed price in Rwandan Francs');
    table.timestamp('estimated_pickup_time', { useTz: true }).comment('Estimated time to pickup');
    
    // Status
    table.string('status', 20).notNullable().comment('Offer status: pending, accepted, rejected, expired');
    
    // Timestamp
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    
    // Unique constraint - one offer per driver per delivery
    table.unique(['delivery_id', 'driver_id'], { indexName: 'uq_driver_offer_per_delivery' });
    
    // Check constraints
    table.check('price_amount > 0', [], 'chk_price_amount_positive');
    table.check(
      "status IN ('pending', 'accepted', 'rejected', 'expired')",
      [],
      'chk_offer_status'
    );
  });
  
  // Create indexes
  await knex.schema.table('price_offers', (table) => {
    table.index('delivery_id', 'idx_price_offers_delivery');
    table.index('driver_id', 'idx_price_offers_driver');
    table.index('status', 'idx_price_offers_status');
  });
  
  console.log('✓ Created price_offers table with constraints and indexes');
  
  // Create bookings table
  await knex.schema.createTable('bookings', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    
    // Foreign keys
    table.uuid('delivery_id').notNullable()
      .references('id').inTable('deliveries').onDelete('CASCADE')
      .comment('Reference to delivery');
    table.uuid('driver_id').notNullable().comment('Driver ID from Rides Platform');
    table.uuid('offer_id').notNullable()
      .references('id').inTable('price_offers')
      .comment('Reference to accepted price offer');
    
    // Booking details
    table.integer('agreed_price').notNullable().comment('Final agreed price in Rwandan Francs');
    table.timestamp('pickup_time', { useTz: true }).comment('Actual pickup time');
    table.timestamp('completion_time', { useTz: true }).comment('Actual completion time');
    
    // Timestamp
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    
    // Unique constraint - one booking per delivery
    table.unique(['delivery_id'], { indexName: 'uq_booking_per_delivery' });
  });
  
  // Create indexes
  await knex.schema.table('bookings', (table) => {
    table.index('delivery_id', 'idx_bookings_delivery');
    table.index('driver_id', 'idx_bookings_driver');
  });
  
  console.log('✓ Created bookings table with constraints and indexes');
  
  // Create status_history table
  await knex.schema.createTable('status_history', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('delivery_id').notNullable()
      .references('id').inTable('deliveries').onDelete('CASCADE');
    table.string('from_status', 30);
    table.string('to_status', 30).notNullable();
    table.uuid('changed_by').notNullable().comment('User ID who made the change');
    table.text('reason');
    table.jsonb('location').comment('Location at time of change');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    
    table.index('delivery_id', 'idx_status_history_delivery');
    table.index('created_at', 'idx_status_history_created_at');
  });
  
  // Create location_tracking table
  await knex.schema.createTable('location_tracking', (table) => {
    table.bigIncrements('id').primary();
    table.uuid('delivery_id').notNullable()
      .references('id').inTable('deliveries').onDelete('CASCADE');
    table.uuid('driver_id').notNullable();
    table.jsonb('location').notNullable();
    table.timestamp('timestamp', { useTz: true }).notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    
    table.index(['delivery_id', 'timestamp'], 'idx_location_tracking_delivery');
    table.index('driver_id', 'idx_location_tracking_driver');
  });
  
  // Create payment_transactions table
  await knex.schema.createTable('payment_transactions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('delivery_id').notNullable().references('id').inTable('deliveries');
    table.integer('amount').notNullable();
    table.string('payment_method', 20).notNullable();
    table.string('phone_number', 15).notNullable();
    table.string('payment_reference', 255);
    table.string('status', 20).notNullable();
    table.string('transaction_type', 20).notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('completed_at', { useTz: true });
    
    table.check("payment_method IN ('MTN', 'Airtel')", [], 'chk_payment_method');
    table.check("status IN ('pending', 'completed', 'failed', 'refunded')", [], 'chk_payment_status');
    table.check("transaction_type IN ('payment', 'refund')", [], 'chk_transaction_type');
    
    table.index('delivery_id', 'idx_payment_transactions_delivery');
    table.index('status', 'idx_payment_transactions_status');
  });
  
  // Create refunds table
  await knex.schema.createTable('refunds', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('delivery_id').notNullable().references('id').inTable('deliveries');
    table.uuid('requested_by').notNullable();
    table.integer('amount').notNullable();
    table.text('reason').notNullable();
    table.string('status', 20).notNullable();
    table.timestamp('requested_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('processed_at', { useTz: true });
    
    table.check("status IN ('requested', 'approved', 'rejected', 'processed')", [], 'chk_refund_status');
    
    table.index('delivery_id', 'idx_refunds_delivery');
    table.index('status', 'idx_refunds_status');
  });
  
  // Create disputes table
  await knex.schema.createTable('disputes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('delivery_id').notNullable().references('id').inTable('deliveries');
    table.uuid('initiated_by').notNullable();
    table.uuid('respondent_id').notNullable();
    table.text('reason').notNullable();
    table.text('evidence');
    table.string('status', 20).notNullable();
    table.text('resolution_notes');
    table.timestamp('initiated_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('resolved_at', { useTz: true });
    
    table.check("status IN ('open', 'under_review', 'resolved', 'closed')", [], 'chk_dispute_status');
    
    table.index('delivery_id', 'idx_disputes_delivery');
    table.index('status', 'idx_disputes_status');
  });
  
  // Create driver_preferences table
  await knex.schema.createTable('driver_preferences', (table) => {
    table.uuid('driver_id').primary();
    table.specificType('categories', 'TEXT[]').notNullable().defaultTo('{}');
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });
  
  // Create GIN index for array search
  await knex.raw('CREATE INDEX idx_driver_preferences_categories ON driver_preferences USING GIN(categories)');
  
  // Create cancellations table
  await knex.schema.createTable('cancellations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('delivery_id').notNullable().references('id').inTable('deliveries');
    table.uuid('cancelled_by').notNullable();
    table.text('reason').notNullable();
    table.boolean('fee_applied').defaultTo(false);
    table.integer('fee_amount').defaultTo(0);
    table.timestamp('cancelled_at', { useTz: true }).defaultTo(knex.fn.now());
    
    table.index('delivery_id', 'idx_cancellations_delivery');
  });
  
  console.log('✓ Created all supporting tables with constraints and indexes');
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('cancellations');
  await knex.schema.dropTableIfExists('driver_preferences');
  await knex.schema.dropTableIfExists('disputes');
  await knex.schema.dropTableIfExists('refunds');
  await knex.schema.dropTableIfExists('payment_transactions');
  await knex.schema.dropTableIfExists('location_tracking');
  await knex.schema.dropTableIfExists('status_history');
  await knex.schema.dropTableIfExists('bookings');
  await knex.schema.dropTableIfExists('price_offers');
  await knex.schema.dropTableIfExists('deliveries');
  console.log('✓ Dropped all tables');
};
