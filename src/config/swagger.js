import swaggerJsdoc from "swagger-jsdoc";
import config from "./index.js";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Rides Delivery Backend API",
      version: "1.0.0",
      description:
        "API documentation for Rides Delivery Backend (Rwanda market). Add/update docs with every new endpoint.",
    },
    servers: [
      {
        url: "/",
        description: "Current server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT token validated via Rides Platform",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            username: { type: "string", example: "john_doe" },
            email: { type: "string", format: "email", example: "john@example.com" },
            phoneNumber: { type: "string", example: "+250788123456" },
            address: { type: "string", nullable: true, example: "KN 5 Ave, Kigali" },
            role: { 
              type: "string", 
              enum: ["customer", "driver", "admin"],
              example: "customer"
            },
            gender: {
              type: "string",
              enum: ["male", "female", "other", "prefer_not_to_say"],
              nullable: true
            },
            categoryPreferences: {
              type: "array",
              items: {
                type: "string",
                enum: ["Parcel", "Restaurant", "Shop", "Cargo"]
              }
            },
            isAvailable: { type: "boolean", example: false },
            isActive: { type: "boolean", example: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            error: { type: "string", example: "Bad Request" },
            message: { type: "string", example: "Validation failed" },
            timestamp: { type: "string", format: "date-time" },
            details: { type: "object", nullable: true },
          },
        },
        PriceOffer: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            deliveryRequestId: { type: "string", format: "uuid" },
            driverId: { type: "string", format: "uuid" },
            offeredPriceRWF: { type: "number", example: 2500 },
            isAccepted: { type: "boolean" },
            isRejected: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            driver: {
              type: "object",
              nullable: true,
              properties: {
                id: { type: "string", format: "uuid" },
                ridesUserId: { type: "string" },
                phoneNumber: { type: "string", example: "+2507XXXXXXXX" },
              },
            },
          },
        },
        SubmitOfferRequest: {
          type: "object",
          required: ["offeredPriceRWF"],
          properties: {
            offeredPriceRWF: {
              type: "number",
              exclusiveMinimum: 0,
              example: 2500,
              description: "Positive offered amount in Rwandan Francs",
            },
          },
        },
        SubmitOfferResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                deliveryRequestId: { type: "string", format: "uuid" },
                driverId: { type: "string", format: "uuid" },
                offeredPriceRWF: { type: "number" },
                isAccepted: { type: "boolean" },
                isRejected: { type: "boolean" },
                createdAt: { type: "string", format: "date-time" },
              },
            },
          },
        },
        GetOffersResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/PriceOffer" },
            },
          },
        },
        AcceptOfferResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                bookingId: { type: "string", format: "uuid" },
                deliveryRequestId: { type: "string", format: "uuid" },
                offerId: { type: "string", format: "uuid" },
                driverId: { type: "string", format: "uuid" },
                agreedPriceRWF: { type: "number" },
                status: { type: "string", example: "confirmed" },
              },
            },
          },
        },
      },
    },
    tags: [
      { 
        name: "Authentication", 
        description: "Authentication endpoints (handled by Rides Platform). In development mode with RIDES_AUTH_MODE=mock, use: driver-token, customer-token, or admin-token"
      },
      { name: "Health", description: "Service health" },
      { name: "Offers", description: "Delivery request price offers" },
      { name: "Negotiation", description: "Price negotiation actions" },
      { name: "Payments", description: "Booking payment method and transactions (MTN/Airtel)" },
    ],
  },
  apis: ["./src/app.js", "./src/routes/**/*.js", "./src/controllers/**/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
