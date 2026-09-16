import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  date,
  time,
  timestamp,
  doublePrecision,
  jsonb,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const userRole = pgEnum('user_role', ['admin', 'driver']);
export const driverStatus = pgEnum('driver_status', ['active', 'inactive']);
export const busStatus = pgEnum('bus_status', ['active', 'inactive']);
export const locationStatus = pgEnum('location_status', [
  'captured',
  'denied',
  'unavailable',
  'unsupported',
]);
export const auditAction = pgEnum('audit_action', [
  'created',
  'edited',
  'voided',
  'restored',
]);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    role: userRole('role').notNull(),
    name: text('name').notNull(),
    email: text('email'),
    passwordHash: text('password_hash'),
    isActive: boolean('is_active').notNull().default(true),
    failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('users_email_unique').on(t.email),
    check(
      'users_admin_has_credentials',
      sql`(${t.role} <> 'admin') OR (${t.email} IS NOT NULL AND ${t.passwordHash} IS NOT NULL)`,
    ),
    check(
      'users_driver_no_credentials',
      sql`(${t.role} <> 'driver') OR (${t.email} IS NULL AND ${t.passwordHash} IS NULL)`,
    ),
  ],
);

export const buses = pgTable('buses', {
  id: uuid('id').primaryKey().defaultRandom(),
  label: text('label').notNull(),
  seatCapacity: integer('seat_capacity').notNull(),
  status: busStatus('status').notNull().default('active'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [check('buses_capacity_positive', sql`${t.seatCapacity} > 0`)]);

export const drivers = pgTable(
  'drivers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    phone: text('phone').notNull(),
    pinHash: text('pin_hash'),
    assignedBusId: uuid('assigned_bus_id').references(() => buses.id, {
      onDelete: 'set null',
    }),
    status: driverStatus('status').notNull().default('active'),
    failedPinAttempts: integer('failed_pin_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('drivers_phone_unique').on(t.phone),
    check('drivers_pin_not_empty', sql`${t.pinHash} IS NULL OR length(${t.pinHash}) > 0`),
  ],
);

export const trips = pgTable(
  'trips',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientRef: uuid('client_ref').notNull().unique(),
    driverId: uuid('driver_id')
      .notNull()
      .references(() => drivers.id, { onDelete: 'cascade' }),
    busId: uuid('bus_id').references(() => buses.id, { onDelete: 'set null' }),
    tripDate: date('trip_date').notNull(),
    fromLocation: text('from_location').notNull(),
    toLocation: text('to_location').notNull(),
    seatsLoaded: integer('seats_loaded').notNull(),
    // Per-seat price; the full trip amount is tripAmountNgn * seatsLoaded.
    tripAmountNgn: integer('trip_amount_ngn').notNull(),
    hasCargo: boolean('has_cargo').notNull().default(false),
    cargoAmountNgn: integer('cargo_amount_ngn'),
    fuelAmountNgn: integer('fuel_amount_ngn').notNull().default(0),
    feedingAmountNgn: integer('feeding_amount_ngn').notNull().default(0),
    arrivalTime: time('arrival_time').notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    accuracyM: doublePrecision('accuracy_m'),
    // Best-effort place name resolved from the GPS point at submission.
    locationAddress: text('location_address'),
    locationStatus: locationStatus('location_status').notNull(),
    // Set when the captured GPS point is far from the claimed From/To route.
    locationMismatch: boolean('location_mismatch').notNull().default(false),
    isVoided: boolean('is_voided').notNull().default(false),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidedByUserId: uuid('voided_by_user_id').references(() => users.id),
    voidReason: text('void_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('trips_driver_date_idx').on(t.driverId, t.tripDate),
    index('trips_date_idx').on(t.tripDate),
    check('trips_seats_range', sql`${t.seatsLoaded} BETWEEN 0 AND 100`),
    check('trips_amount_non_negative', sql`${t.tripAmountNgn} >= 0`),
    check(
      'trips_cargo_amount_when_has_cargo',
      sql`(${t.hasCargo} = false) OR (${t.cargoAmountNgn} IS NOT NULL)`,
    ),
    check('trips_cargo_amount_non_negative', sql`(${t.cargoAmountNgn} IS NULL) OR (${t.cargoAmountNgn} >= 0)`),
    check('trips_fuel_non_negative', sql`${t.fuelAmountNgn} >= 0`),
    check('trips_feeding_non_negative', sql`${t.feedingAmountNgn} >= 0`),
    check(
      'trips_void_fields',
      sql`(${t.isVoided} = false) OR (${t.voidedAt} IS NOT NULL AND ${t.voidedByUserId} IS NOT NULL AND ${t.voidReason} IS NOT NULL)`,
    ),
  ],
);

export const tripAudit = pgTable(
  'trip_audit',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    action: auditAction('action').notNull(),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id),
    note: text('note').notNull(),
    changes: jsonb('changes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('trip_audit_trip_idx').on(t.tripId)],
);

export type User = typeof users.$inferSelect;
export type Driver = typeof drivers.$inferSelect;
export type Bus = typeof buses.$inferSelect;
export type Trip = typeof trips.$inferSelect;
export type TripAudit = typeof tripAudit.$inferSelect;
