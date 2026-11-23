

const CATEGORIES = "('Parcel','Restaurant','Shop','Cargo')";
const STATUSES =
  "('open','negotiating','confirmed','rejected','in_progress','failed','completed'," +
  "'returning','returned','cancelled','refund_requested','refund_processed','disputed')";
const PAYMENT_METHODS = "('mtn_mobile_money','airtel_money')";
const ACTIVE_BOOKING = "('confirmed','in_progress','returning')";

// Rwanda phone format: +250 followed by 9 digits (Req 2.9, 20.3)
const phoneCheck = (col) => `${col} ~ '^\\+250[0-9]{9}$'`;

exports.up = (pgm) => {
  // ---------------------------------------------------------------- users
  pgm.createTable('users', {
    id: { type: 'text', primaryKey: true }, // the Rides user ID (Req 1.3)
    role: { type: 'text', notNull: true, check: "role IN ('admin','driver','customer')" },
    full_name: { type: 'text' },
    phone: { type: 'text', check: phoneCheck('phone') },
    // Driver category preferences (Req 14.5-14.7). Empty array = show all.
    category_preferences: {
      type: 'text[]',
      notNull: true,
      default: pgm.func("'{}'"),
      check: "category_preferences <@ ARRAY['Parcel','Restaurant','Shop','Cargo']",
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // ----------------------------------------------------- delivery_requests
  pgm.createTable('delivery_requests', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    customer_id: { type: 'text', notNull: true, references: 'users(id)' },
    category: { type: 'text', notNull: true, check: `category IN ${CATEGORIES}` },
    item_description: { type: 'text', notNull: true },

    pickup_lat: { type: 'numeric(9,6)', notNull: true, check: 'pickup_lat BETWEEN -90 AND 90' },
    pickup_lng: { type: 'numeric(9,6)', notNull: true, check: 'pickup_lng BETWEEN -180 AND 180' },
    destination_lat: { type: 'numeric(9,6)', notNull: true, check: 'destination_lat BETWEEN -90 AND 90' },
    destination_lng: { type: 'numeric(9,6)', notNull: true, check: 'destination_lng BETWEEN -180 AND 180' },

    customer_phone: { type: 'text', check: phoneCheck('customer_phone') },
    recipient_phone: { type: 'text', check: phoneCheck('recipient_phone') },

    estimated_distance_km: { type: 'numeric(8,2)' },
    return_distance_km: { type: 'numeric(8,2)' }, // Req 10.5, kept separate

    // Integration with Restaurant / Shop / Collection Point modules (Req 22-24).
    // Plain reference columns only: no merchant or catalog tables.
    source_module: {
      type: 'text',
      notNull: true,
      default: 'direct',
      check: "source_module IN ('direct','restaurant','shop')",
    },
    source_reference_id: { type: 'text' },
    pickup_collection_point_id: { type: 'text' },
    destination_collection_point_id: { type: 'text' },

    // Category-specific attributes (Req 15)
    temperature_note: {
      type: 'text',
      check: "temperature_note IN ('hot','cold','frozen','room_temperature')",
    },
    preparation_time_minutes: { type: 'integer', check: 'preparation_time_minutes >= 0' },
    cargo_vehicle_type: {
      type: 'text',
      check: "cargo_vehicle_type IN ('van','small_truck','large_truck','flatbed')",
    },
    cargo_weight_kg: { type: 'numeric(10,2)', check: 'cargo_weight_kg > 0' },
    cargo_dimensions: { type: 'text' },
    fragility_level: { type: 'text', check: "fragility_level IN ('fragile','standard','durable')" },
    package_size: { type: 'text', check: "package_size IN ('small','medium','large','extra_large')" },

    status: { type: 'text', notNull: true, default: 'open', check: `status IN ${STATUSES}` },

    // Used by the 48-hour refund and 7-day dispute windows (Req 11.3, 12.3)
    completed_at: { type: 'timestamptz' },
    returned_at: { type: 'timestamptz' },

    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  // Cargo deliveries must name a vehicle type (Req 15.3)
  pgm.addConstraint('delivery_requests', 'cargo_requires_vehicle_type', {
    check: "category <> 'Cargo' OR cargo_vehicle_type IS NOT NULL",
  });
  pgm.createIndex('delivery_requests', 'status');
  pgm.createIndex('delivery_requests', 'customer_id');
  pgm.createIndex('delivery_requests', 'category');

  // --------------------------------------------------------- price_offers
  pgm.createTable('price_offers', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    delivery_request_id: { type: 'uuid', notNull: true, references: 'delivery_requests(id)' },
    driver_id: { type: 'text', notNull: true, references: 'users(id)' },
    amount_rwf: { type: 'bigint', notNull: true, check: 'amount_rwf > 0' }, // Req 20.5
    status: {
      type: 'text',
      notNull: true,
      default: 'pending',
      check: "status IN ('pending','accepted','rejected','withdrawn')",
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('price_offers', 'delivery_request_id');
  pgm.createIndex('price_offers', 'driver_id');
  // A driver may have only one pending offer per request
  pgm.createIndex('price_offers', ['delivery_request_id', 'driver_id'], {
    unique: true,
    where: "status = 'pending'",
    name: 'one_pending_offer_per_driver_per_request',
  });

  // ------------------------------------------------------------- bookings
  pgm.createTable('bookings', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    delivery_request_id: { type: 'uuid', notNull: true, references: 'delivery_requests(id)' },
    price_offer_id: { type: 'uuid', notNull: true, references: 'price_offers(id)' },
    customer_id: { type: 'text', notNull: true, references: 'users(id)' },
    driver_id: { type: 'text', notNull: true, references: 'users(id)' },
    agreed_price_rwf: { type: 'bigint', notNull: true, check: 'agreed_price_rwf > 0' },
    status: {
      type: 'text',
      notNull: true,
      default: 'confirmed',
      check:
        "status IN ('confirmed','in_progress','completed','failed','returning','returned','cancelled','rejected')",
    },
    cancellation_fee_rwf: { type: 'bigint', notNull: true, default: 0, check: 'cancellation_fee_rwf >= 0' },
    confirmed_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') }, // 5-minute rule
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('bookings', 'delivery_request_id');
  // The database itself blocks simultaneous deliveries (Req 4.5)...
  pgm.createIndex('bookings', 'driver_id', {
    unique: true,
    where: `status IN ${ACTIVE_BOOKING}`,
    name: 'one_active_booking_per_driver',
  });
  // ...and a second active booking on the same request (Req 4.2)
  pgm.createIndex('bookings', 'delivery_request_id', {
    unique: true,
    where: `status IN ${ACTIVE_BOOKING}`,
    name: 'one_active_booking_per_request',
  });

  // ----------------------------------------------------- location_tracking
  pgm.createTable('location_tracking', {
    id: { type: 'bigserial', primaryKey: true },
    delivery_request_id: { type: 'uuid', notNull: true, references: 'delivery_requests(id)' },
    booking_id: { type: 'uuid', notNull: true, references: 'bookings(id)' },
    driver_id: { type: 'text', notNull: true, references: 'users(id)' },
    lat: { type: 'numeric(9,6)', notNull: true, check: 'lat BETWEEN -90 AND 90' },
    lng: { type: 'numeric(9,6)', notNull: true, check: 'lng BETWEEN -180 AND 180' },
    phase: { type: 'text', notNull: true, default: 'delivery', check: "phase IN ('delivery','return')" },
    recorded_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  // Fast "latest location for this delivery" lookups (Req 5.3)
  pgm.createIndex('location_tracking', ['delivery_request_id', { name: 'recorded_at', sort: 'DESC' }]);

  // ---------------------------------------------------- payment_transactions
  pgm.createTable('payment_transactions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    delivery_request_id: { type: 'uuid', notNull: true, references: 'delivery_requests(id)' },
    booking_id: { type: 'uuid', notNull: true, references: 'bookings(id)' },
    customer_id: { type: 'text', notNull: true, references: 'users(id)' },
    amount_rwf: { type: 'bigint', notNull: true, check: 'amount_rwf > 0' },
    payment_method: { type: 'text', notNull: true, check: `payment_method IN ${PAYMENT_METHODS}` },
    payer_phone: { type: 'text', check: phoneCheck('payer_phone') },
    transaction_reference: { type: 'text', unique: true },
    status: {
      type: 'text',
      notNull: true,
      default: 'pending',
      check: "status IN ('pending','completed','failed')",
    },
    failure_reason: { type: 'text' },
    transaction_at: { type: 'timestamptz' }, // set when payment is confirmed (Req 16.5)
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('payment_transactions', 'delivery_request_id');

  // -------------------------------------------------------- status_history
  pgm.createTable('status_history', {
    id: { type: 'bigserial', primaryKey: true },
    delivery_request_id: { type: 'uuid', notNull: true, references: 'delivery_requests(id)' },
    from_status: { type: 'text', check: `from_status IN ${STATUSES}` }, // empty on first entry
    to_status: { type: 'text', notNull: true, check: `to_status IN ${STATUSES}` },
    changed_by: { type: 'text', references: 'users(id)' }, // empty when the system acts
    actor_role: {
      type: 'text',
      notNull: true,
      check: "actor_role IN ('customer','driver','admin','system')",
    },
    reason: { type: 'text' },
    // Extra details: failure location, refund amount, return distance, and so on
    metadata: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('status_history', ['delivery_request_id', 'created_at']);

  // Make the audit trail immutable: no UPDATE and no DELETE, ever.
  pgm.sql(`
    CREATE FUNCTION forbid_status_history_changes() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'status_history is append-only';
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER status_history_immutable
    BEFORE UPDATE OR DELETE ON status_history
    FOR EACH ROW EXECUTE FUNCTION forbid_status_history_changes();
  `);

  // --------------------------------------------------------------- refunds
  pgm.createTable('refunds', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    delivery_request_id: { type: 'uuid', notNull: true, references: 'delivery_requests(id)' },
    customer_id: { type: 'text', notNull: true, references: 'users(id)' },
    amount_rwf: { type: 'bigint', notNull: true, check: 'amount_rwf > 0' },
    reason: { type: 'text', notNull: true }, // required by Req 11.2
    status: {
      type: 'text',
      notNull: true,
      default: 'requested',
      check: "status IN ('requested','approved','rejected','processed','failed')",
    },
    requested_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    approved_at: { type: 'timestamptz' },
    approved_by: { type: 'text', references: 'users(id)' },
    payment_method: { type: 'text', check: `payment_method IN ${PAYMENT_METHODS}` },
    refund_transaction_reference: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('refunds', 'delivery_request_id');

  // -------------------------------------------------------------- disputes
  pgm.createTable('disputes', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    delivery_request_id: { type: 'uuid', notNull: true, references: 'delivery_requests(id)' },
    initiated_by: { type: 'text', notNull: true, references: 'users(id)' },
    respondent_id: { type: 'text', notNull: true, references: 'users(id)' },
    reason: { type: 'text', notNull: true },
    evidence_description: { type: 'text' },
    status: { type: 'text', notNull: true, default: 'open', check: "status IN ('open','resolved')" },
    resolution_notes: { type: 'text' },
    outcome: { type: 'text' },
    resolved_by: { type: 'text', references: 'users(id)' },
    resolved_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('disputes', 'initiator_differs_from_respondent', {
    check: 'initiated_by <> respondent_id',
  });
  // Only one open dispute per delivery
  pgm.createIndex('disputes', 'delivery_request_id', {
    unique: true,
    where: "status = 'open'",
    name: 'one_open_dispute_per_delivery',
  });
};

exports.down = (pgm) => {
  // Reverse order: tables that point to others are dropped first.
  pgm.dropTable('disputes');
  pgm.dropTable('refunds');
  pgm.dropTable('status_history');
  pgm.sql('DROP FUNCTION IF EXISTS forbid_status_history_changes()');
  pgm.dropTable('payment_transactions');
  pgm.dropTable('location_tracking');
  pgm.dropTable('bookings');
  pgm.dropTable('price_offers');
  pgm.dropTable('delivery_requests');
  pgm.dropTable('users');
};