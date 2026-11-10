# Requirements Document

## Introduction

This document defines the requirements for a delivery backend system that extends the existing Rides platform to support courier and package delivery operations in Rwanda. The system manages delivery requests for parcels, restaurant food, shop products, and cargo with multi-driver negotiation, real-time tracking, and delivery completion. The system facilitates negotiation-based pricing where customers and drivers agree on delivery costs through a bidding process. The system integrates with the existing Rides authentication, user management, driver, and vehicle systems, and will be built using Express.js and PostgreSQL to provide RESTful APIs for mobile and web clients.

## Glossary

- **Delivery_Service**: The backend system that manages courier and package delivery operations as an extension to the Rides platform
- **Rides_Platform**: The existing ride-hailing platform providing authentication, user management, driver, and vehicle systems
- **Customer**: A user who requests delivery service (authenticated through Rides_Platform)
- **Driver**: A user who provides transportation services for deliveries (managed through Rides_Platform driver system)
- **Delivery_Request**: A request to transport a package, food, shop product, or cargo from pickup location to destination location
- **Price_Offer**: A proposed delivery price in Rwandan Francs submitted by a driver to a customer
- **Negotiation**: The process where drivers make price offers and customers accept or wait for better offers
- **Booking**: A confirmed delivery request where customer and driver have agreed on price
- **Location**: Geographic coordinates (latitude and longitude) within Rwanda
- **Status**: The current state of a delivery (open, negotiating, confirmed, rejected, in_progress, failed, completed, returning, returned, cancelled, refund_requested, refund_processed, disputed)
- **Rejection**: Driver declines a confirmed booking before starting delivery
- **Failure**: Delivery attempt was unsuccessful due to customer unavailability, incorrect address, or other issues
- **Return**: Package is being returned to the original pickup location
- **Refund**: Financial reimbursement to customer in Rwandan Francs due to delivery issues
- **Dispute**: A disagreement between customer and driver regarding delivery execution or payment
- **Database**: PostgreSQL database storing delivery system data
- **Delivery_Category**: The type of delivery service (Parcel, Restaurant, Shop, or Cargo)
- **Parcel**: Standard package or parcel delivery service
- **Restaurant**: Food delivery service from restaurants requiring time-sensitive handling
- **Shop**: Item delivery service from shops or stores
- **Cargo**: Large cargo or freight delivery service requiring specialized vehicles
- **Restaurant_Module**: The existing Rides platform module managing restaurant information and food orders
- **Shop_Module**: The existing Rides platform module managing shop information and product orders
- **Collection_Point_Module**: The existing Rides platform module managing pickup locations
- **Mobile_Money**: Payment systems including MTN Mobile Money and Airtel Money
- **Payment_Transaction**: A mobile money payment record with transaction reference and status

## Requirements

### Requirement 1: Integration with Rides Authentication System

**User Story:** As a customer or driver, I want to use my existing Rides account to access delivery services, so that I have a seamless experience across the platform.

#### Acceptance Criteria

1. WHEN a user accesses delivery services, THE Delivery_Service SHALL authenticate users through the Rides_Platform authentication system
2. WHEN a valid Rides_Platform authentication token is provided, THE Delivery_Service SHALL authorize access to delivery operations
3. THE Delivery_Service SHALL use the Rides_Platform user identifier for all delivery records
4. WHEN authentication fails, THE Delivery_Service SHALL return an unauthorized error with the Rides_Platform error details
5. THE Delivery_Service SHALL verify user roles (customer or driver) through the Rides_Platform before allowing role-specific operations

### Requirement 2: Customer Delivery Request Creation

**User Story:** As a customer, I want to post a delivery request with pickup and destination locations, so that drivers can see it and make price offers.

#### Acceptance Criteria

1. WHEN an authenticated customer submits a delivery request with valid pickup location, destination location, delivery category, and item description, THE Delivery_Service SHALL create an open delivery request
2. THE Delivery_Service SHALL validate that pickup and destination locations contain valid latitude and longitude coordinates within Rwanda
3. THE Delivery_Service SHALL validate that delivery category is one of the four valid types: Parcel, Restaurant, Shop, or Cargo
4. THE Delivery_Service SHALL require item description (package details, food items, shop products, or cargo details) for all delivery requests
5. WHEN a customer submits a delivery request without authentication, THE Delivery_Service SHALL return an unauthorized error
6. WHEN a customer submits a delivery request without a delivery category, THE Delivery_Service SHALL return a validation error
7. THE Delivery_Service SHALL store delivery requests in the Database with a unique identifier, timestamp, delivery category, and status of open
8. THE Delivery_Service SHALL calculate and display estimated distance in kilometers for Rwanda locations
9. THE Delivery_Service SHALL accept Rwanda phone numbers in the format +250XXXXXXXXX for customer and recipient contact information

### Requirement 3: Driver Price Offer Submission

**User Story:** As a driver, I want to make price offers on open delivery requests, so that I can negotiate and win delivery jobs.

#### Acceptance Criteria

1. WHEN an authenticated driver views open delivery requests, THE Delivery_Service SHALL display all requests with status open that do not have a confirmed booking
2. WHERE a driver has specified category preferences, THE Delivery_Service SHALL filter displayed delivery requests to match the driver's preferred categories
3. WHEN a driver submits a price offer for an open delivery request, THE Delivery_Service SHALL create a price offer record with the proposed amount in Rwandan Francs and driver identifier from the Rides_Platform
4. THE Delivery_Service SHALL allow multiple drivers to submit different price offers for the same delivery request
5. THE Delivery_Service SHALL update the delivery request status to negotiating when the first price offer is received
6. THE Delivery_Service SHALL store all price offers in the Database with timestamp and driver details from the Rides_Platform driver system
7. WHEN a driver submits a price offer, THE Delivery_Service SHALL notify the customer of the new offer
8. THE Delivery_Service SHALL verify driver availability and vehicle information through the Rides_Platform before allowing price offers

### Requirement 4: Customer Price Offer Acceptance

**User Story:** As a customer, I want to review price offers from drivers and accept one, so that I can confirm my delivery at an agreed price.

#### Acceptance Criteria

1. WHEN an authenticated customer views their delivery request, THE Delivery_Service SHALL display all price offers received with driver details and proposed amounts
2. WHEN a customer accepts a price offer, THE Delivery_Service SHALL update the delivery request status to confirmed and create a booking record
3. WHEN a booking is confirmed, THE Delivery_Service SHALL record the agreed price and assign the selected driver to the delivery
4. IF a customer does not accept any price offers, THEN THE Delivery_Service SHALL keep the delivery request open for additional driver offers
5. THE Delivery_Service SHALL prevent a driver from accepting multiple deliveries simultaneously
6. WHEN a customer accepts a price offer, THE Delivery_Service SHALL notify the selected driver and reject all other pending offers for that delivery request

### Requirement 5: Real-Time Location Tracking

**User Story:** As a customer, I want to track my driver's location in real-time, so that I know when they will arrive.

#### Acceptance Criteria

1. WHILE a delivery is in progress, THE Delivery_Service SHALL accept location updates from the driver at minimum 10-second intervals
2. WHEN a driver location update is received, THE Delivery_Service SHALL store the location with timestamp in the Database
3. WHEN a customer requests the current driver location, THE Delivery_Service SHALL return the most recent location within 30 seconds
4. THE Delivery_Service SHALL calculate estimated time of arrival based on current driver location and destination

### Requirement 6: Delivery Status Management

**User Story:** As a driver, I want to update the status of my current delivery, so that customers know the progress.

#### Acceptance Criteria

1. WHEN a driver arrives at pickup location, THE Delivery_Service SHALL allow status update to in_progress
2. WHEN a driver completes a delivery successfully, THE Delivery_Service SHALL allow status update to completed
3. THE Delivery_Service SHALL enforce valid status transitions according to the delivery lifecycle
4. THE Delivery_Service SHALL support these primary status flows: open → negotiating → confirmed → in_progress → completed
5. THE Delivery_Service SHALL support these alternative flows: confirmed → rejected → open, in_progress → failed → returning → returned, completed → disputed, completed → refund_requested → refund_processed
6. THE Delivery_Service SHALL record timestamp and user identifier for each status change
7. IF an invalid status transition is attempted, THEN THE Delivery_Service SHALL return an error describing the valid transitions
8. THE Delivery_Service SHALL allow status transition to cancelled from open, negotiating, confirmed, or rejected states

### Requirement 7: Delivery Cancellation

**User Story:** As a customer or driver, I want to cancel a delivery under certain conditions, so that I can handle changes in plans.

#### Acceptance Criteria

1. WHEN a customer cancels an open or negotiating delivery request, THE Delivery_Service SHALL update status to cancelled and notify all drivers with pending price offers
2. WHEN a customer cancels a confirmed delivery within 5 minutes of accepting a price offer, THE Delivery_Service SHALL update status to cancelled without penalty
3. WHEN a customer cancels a confirmed delivery after 5 minutes, THE Delivery_Service SHALL update status to cancelled and apply a cancellation fee
4. WHEN a driver cancels a confirmed delivery, THE Delivery_Service SHALL return the delivery to open status and notify the customer
5. THE Delivery_Service SHALL prevent cancellation of deliveries with status in_progress, failed, completed, returning, or returned
6. WHEN a cancellation occurs, THE Delivery_Service SHALL record the cancellation reason, timestamp, and initiating user

### Requirement 8: Driver Rejection After Acceptance

**User Story:** As a driver, I want to reject a confirmed delivery before starting, so that I can handle emergencies or scheduling conflicts.

#### Acceptance Criteria

1. WHEN a driver rejects a confirmed delivery, THE Delivery_Service SHALL update status to rejected and record the rejection reason
2. WHEN a delivery is rejected by driver, THE Delivery_Service SHALL return the delivery status to open and notify the customer
3. THE Delivery_Service SHALL allow all previously rejected price offers to become available again for customer acceptance
4. THE Delivery_Service SHALL record driver rejection in the driver's history for accountability tracking
5. IF a driver rejects a delivery after status is in_progress, THEN THE Delivery_Service SHALL return an error indicating rejection is not allowed
6. THE Delivery_Service SHALL notify the customer with the rejection reason and timestamp

### Requirement 9: Delivery Failure Handling

**User Story:** As a driver, I want to mark a delivery as failed when I cannot complete it, so that the system can handle the unsuccessful attempt properly.

#### Acceptance Criteria

1. WHEN a driver marks a delivery as failed during in_progress status, THE Delivery_Service SHALL update status to failed and record the failure reason
2. THE Delivery_Service SHALL require a failure reason from this list: customer_not_available, incorrect_address, access_denied, package_damaged, customer_refused, other
3. WHEN a delivery fails, THE Delivery_Service SHALL notify the customer with the failure reason and timestamp
4. WHEN a delivery is marked as failed, THE Delivery_Service SHALL automatically update status to returning to initiate return process
5. THE Delivery_Service SHALL record failure location coordinates at time of failure
6. IF a driver attempts to mark a delivery as failed before status is in_progress, THEN THE Delivery_Service SHALL return an error

### Requirement 10: Package Return Process

**User Story:** As a driver, I want to return a package to the original pickup location after a failed delivery, so that the sender can recover it.

#### Acceptance Criteria

1. WHEN a delivery status changes to failed, THE Delivery_Service SHALL automatically update status to returning
2. WHILE a delivery has status returning, THE Delivery_Service SHALL track driver location as they return to original pickup location
3. WHEN a driver arrives at original pickup location with returning status, THE Delivery_Service SHALL allow status update to returned
4. WHEN a delivery status is updated to returned, THE Delivery_Service SHALL notify both customer and sender
5. THE Delivery_Service SHALL calculate return distance in kilometers and record it separately from original delivery distance
6. WHEN a package is returned, THE Delivery_Service SHALL record return completion timestamp and final driver location

### Requirement 11: Refund Request and Processing

**User Story:** As a customer, I want to request a refund for problematic deliveries, so that I am not charged for unsatisfactory service.

#### Acceptance Criteria

1. WHEN a customer requests a refund for a completed, failed, or returned delivery, THE Delivery_Service SHALL update status to refund_requested
2. WHEN a refund is requested, THE Delivery_Service SHALL require a refund reason from the customer
3. THE Delivery_Service SHALL allow refund requests within 48 hours of delivery completion or return
4. WHEN a refund is approved, THE Delivery_Service SHALL update status to refund_processed and record approval timestamp
5. THE Delivery_Service SHALL store refund amount in Rwandan Francs, reason, request timestamp, and approval timestamp
6. IF a refund is requested after 48 hours, THEN THE Delivery_Service SHALL return an error indicating the refund window has expired
7. THE Delivery_Service SHALL notify the driver when a refund is requested for their delivery
8. WHEN a refund is processed, THE Delivery_Service SHALL initiate a mobile money refund transaction through MTN Mobile Money or Airtel Money

### Requirement 12: Dispute Management

**User Story:** As a customer or driver, I want to raise a dispute about a delivery, so that conflicts can be resolved formally.

#### Acceptance Criteria

1. WHEN a customer or driver raises a dispute for a completed, failed, or returned delivery, THE Delivery_Service SHALL update status to disputed
2. WHEN a dispute is raised, THE Delivery_Service SHALL record the dispute reason, supporting evidence description, and timestamp
3. THE Delivery_Service SHALL allow disputes to be raised within 7 days of delivery completion or return
4. THE Delivery_Service SHALL notify the other party when a dispute is raised
5. THE Delivery_Service SHALL prevent further status changes while status is disputed
6. THE Delivery_Service SHALL store dispute initiator, respondent, reason, and resolution notes
7. IF a dispute is raised after 7 days, THEN THE Delivery_Service SHALL return an error indicating the dispute window has expired
8. WHEN a dispute is resolved, THE Delivery_Service SHALL record resolution details and final outcome

### Requirement 13: Delivery History

**User Story:** As a customer or driver, I want to view my past deliveries, so that I can track my activity.

#### Acceptance Criteria

1. WHEN an authenticated customer requests delivery history, THE Delivery_Service SHALL return all deliveries associated with the customer ordered by timestamp descending
2. WHEN an authenticated driver requests job history, THE Delivery_Service SHALL return all completed deliveries ordered by timestamp descending
3. THE Delivery_Service SHALL include status, locations, timestamps, and agreed price information in history records
4. THE Delivery_Service SHALL support pagination with a maximum of 50 records per page

### Requirement 14: Driver Availability and Category Preferences

**User Story:** As a driver, I want to toggle my availability status and specify which delivery categories I handle, so that I can control when I receive job requests and what types of deliveries I accept.

#### Acceptance Criteria

1. WHEN a driver sets status to available through the Rides_Platform, THE Delivery_Service SHALL include the driver in job assignment queries
2. WHEN a driver sets status to unavailable through the Rides_Platform, THE Delivery_Service SHALL exclude the driver from new job assignments
3. THE Delivery_Service SHALL retrieve driver availability status from the Rides_Platform driver system
4. WHILE a driver has an active job, THE Delivery_Service SHALL maintain available status until job completion
5. THE Delivery_Service SHALL allow drivers to specify one or more delivery categories they handle from the list: Parcel, Restaurant, Shop, Cargo
6. WHEN a driver updates category preferences, THE Delivery_Service SHALL store the selected categories in the Database
7. WHERE a driver has not specified category preferences, THE Delivery_Service SHALL default to showing all delivery categories
8. THE Delivery_Service SHALL retrieve driver vehicle information from the Rides_Platform for vehicle type validation in Cargo deliveries

### Requirement 15: Category-Specific Delivery Attributes

**User Story:** As a customer, I want to provide category-specific information for my delivery, so that drivers have the details they need for specialized deliveries.

#### Acceptance Criteria

1. WHERE delivery category is Restaurant, THE Delivery_Service SHALL allow customers to provide optional temperature control notes (hot, cold, frozen, room_temperature)
2. WHERE delivery category is Restaurant, THE Delivery_Service SHALL allow customers to specify estimated preparation time
3. WHERE delivery category is Cargo, THE Delivery_Service SHALL require vehicle type specification from the list: van, small_truck, large_truck, flatbed
4. WHERE delivery category is Cargo, THE Delivery_Service SHALL allow customers to provide weight and dimensions information
5. WHERE delivery category is Shop, THE Delivery_Service SHALL allow customers to specify fragility level (fragile, standard, durable)
6. WHERE delivery category is Parcel, THE Delivery_Service SHALL allow customers to specify package size (small, medium, large, extra_large)
7. THE Delivery_Service SHALL store category-specific attributes in the Database associated with the delivery request
8. WHEN displaying delivery requests to drivers, THE Delivery_Service SHALL include all category-specific attributes

### Requirement 16: Negotiated Price Recording and Mobile Money Payment Integration

**User Story:** As a customer, I want to see the agreed delivery price and pay through mobile money, so that I can complete payment conveniently.

#### Acceptance Criteria

1. WHEN a customer accepts a driver's price offer, THE Delivery_Service SHALL record the agreed price in Rwandan Francs in the booking record
2. WHEN a delivery is completed, THE Delivery_Service SHALL initiate a mobile money payment request for the agreed amount
3. THE Delivery_Service SHALL support payment through MTN Mobile Money and Airtel Money
4. WHEN a mobile money payment is initiated, THE Delivery_Service SHALL create a Payment_Transaction record with transaction reference, amount, payment method, and status
5. WHEN a mobile money payment is confirmed, THE Delivery_Service SHALL update the Payment_Transaction status to completed and record the transaction timestamp
6. THE Delivery_Service SHALL allow customers to view all price offers in Rwandan Francs before accepting one
7. THE Delivery_Service SHALL store each price offer with driver identifier, proposed amount in Rwandan Francs, and timestamp
8. WHEN displaying delivery history, THE Delivery_Service SHALL include the negotiated price and payment status for each delivery
9. IF a mobile money payment fails, THEN THE Delivery_Service SHALL update Payment_Transaction status to failed and allow payment retry

### Requirement 17: Data Persistence and Integrity

**User Story:** As a system administrator, I want all data to be persisted reliably, so that no information is lost.

#### Acceptance Criteria

1. THE Delivery_Service SHALL use PostgreSQL transactions for all data modifications involving multiple tables
2. WHEN a database operation fails, THE Delivery_Service SHALL roll back the transaction and return an error
3. THE Database SHALL enforce foreign key constraints between users, delivery requests, price offers, and bookings
4. THE Database SHALL store timestamps in UTC format
5. THE Delivery_Service SHALL validate all input data before database operations

### Requirement 18: API Error Handling

**User Story:** As a client application developer, I want consistent error responses, so that I can handle errors properly.

#### Acceptance Criteria

1. WHEN an error occurs, THE Delivery_Service SHALL return a JSON response with error code, message, and timestamp
2. THE Delivery_Service SHALL return HTTP 400 for client validation errors
3. THE Delivery_Service SHALL return HTTP 401 for authentication failures
4. THE Delivery_Service SHALL return HTTP 404 for resource not found errors
5. THE Delivery_Service SHALL return HTTP 500 for internal server errors and log the full error details

### Requirement 19: API Rate Limiting

**User Story:** As a system administrator, I want to prevent API abuse, so that the system remains available for all users.

#### Acceptance Criteria

1. THE Delivery_Service SHALL limit authenticated users to 100 requests per minute
2. THE Delivery_Service SHALL limit unauthenticated requests to 20 requests per minute per IP address
3. WHEN rate limit is exceeded, THE Delivery_Service SHALL return HTTP 429 with retry-after header
4. THE Delivery_Service SHALL reset rate limit counters every minute

### Requirement 20: Input Validation and Rwanda-Specific Formats

**User Story:** As a system administrator, I want all inputs to be validated with Rwanda-specific formats, so that the system is protected from invalid data.

#### Acceptance Criteria

1. THE Delivery_Service SHALL validate that latitude values are between -90 and 90 degrees
2. THE Delivery_Service SHALL validate that longitude values are between -180 and 180 degrees
3. THE Delivery_Service SHALL validate that Rwanda phone numbers match the format +250XXXXXXXXX where X represents digits
4. THE Delivery_Service SHALL reject requests with missing required fields and return descriptive error messages
5. THE Delivery_Service SHALL validate that price offers contain positive numeric values in Rwandan Francs
6. THE Delivery_Service SHALL validate that delivery category is one of the four valid types: Parcel, Restaurant, Shop, or Cargo
7. THE Delivery_Service SHALL validate that distance calculations use kilometers as the unit of measurement

### Requirement 21: Database Schema Management

**User Story:** As a developer, I want database schema versioning, so that migrations can be tracked and applied consistently.

#### Acceptance Criteria

1. THE Delivery_Service SHALL use database migration tools to manage schema changes
2. THE Delivery_Service SHALL maintain migration history in the Database
3. WHEN the application starts, THE Delivery_Service SHALL verify that all migrations have been applied
4. THE Delivery_Service SHALL prevent application startup if pending migrations exist

### Requirement 22: Restaurant Module Integration

**User Story:** As a customer, I want to create delivery requests directly from restaurant food orders, so that I can have my food delivered seamlessly.

#### Acceptance Criteria

1. WHEN a customer completes a food order in the Restaurant_Module, THE Delivery_Service SHALL accept delivery request creation with the restaurant location as pickup
2. WHERE a delivery request originates from the Restaurant_Module, THE Delivery_Service SHALL automatically set delivery category to Restaurant
3. THE Delivery_Service SHALL retrieve restaurant location coordinates from the Restaurant_Module for pickup location
4. WHEN a Restaurant delivery is confirmed, THE Delivery_Service SHALL notify the Restaurant_Module with driver details and estimated pickup time
5. THE Delivery_Service SHALL send delivery status updates to the Restaurant_Module for order tracking
6. THE Delivery_Service SHALL accept food preparation time from the Restaurant_Module to optimize driver dispatch timing

### Requirement 23: Shop Module Integration

**User Story:** As a customer, I want to create delivery requests directly from shop product orders, so that my purchases are delivered automatically.

#### Acceptance Criteria

1. WHEN a customer completes a product order in the Shop_Module, THE Delivery_Service SHALL accept delivery request creation with the shop location as pickup
2. WHERE a delivery request originates from the Shop_Module, THE Delivery_Service SHALL automatically set delivery category to Shop
3. THE Delivery_Service SHALL retrieve shop location coordinates from the Shop_Module for pickup location
4. WHEN a Shop delivery is confirmed, THE Delivery_Service SHALL notify the Shop_Module with driver details and estimated pickup time
5. THE Delivery_Service SHALL send delivery status updates to the Shop_Module for order fulfillment tracking
6. THE Delivery_Service SHALL accept product details including fragility information from the Shop_Module

### Requirement 24: Collection Point Module Integration

**User Story:** As a customer, I want to use collection points for package pickup or delivery, so that I have flexible delivery options.

#### Acceptance Criteria

1. WHEN a customer selects a collection point in the Collection_Point_Module, THE Delivery_Service SHALL retrieve the collection point location coordinates
2. THE Delivery_Service SHALL accept collection points as either pickup locations or destination locations
3. WHERE a collection point is used, THE Delivery_Service SHALL retrieve operating hours from the Collection_Point_Module
4. WHEN a delivery to a collection point is completed, THE Delivery_Service SHALL notify the Collection_Point_Module with package details and customer information
5. THE Delivery_Service SHALL validate that selected collection points are operational before accepting delivery requests

### Requirement 25: Streamlined User Experience

**User Story:** As a customer or driver, I want simple and efficient workflows, so that I can complete tasks with minimal effort.

#### Acceptance Criteria

1. THE Delivery_Service SHALL require only essential information for delivery request creation: pickup location, destination location, delivery category, and item description
2. THE Delivery_Service SHALL pre-fill customer contact information from the Rides_Platform user profile
3. WHEN a customer creates multiple deliveries, THE Delivery_Service SHALL remember the last used pickup location as a suggested default
4. THE Delivery_Service SHALL allow price offer acceptance with a single confirmation action
5. THE Delivery_Service SHALL limit driver status updates to one-tap actions for common transitions: start_pickup, start_delivery, complete_delivery
6. WHEN displaying price offers to customers, THE Delivery_Service SHALL sort them by lowest price first
7. THE Delivery_Service SHALL minimize repeated data entry by reusing location data from recent deliveries

