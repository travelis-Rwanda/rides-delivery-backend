
const errorResponse = (description, code, message) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/ErrorResponse' },
      example: {
        error: { code, message, timestamp: '2026-11-22T10:00:00.000Z' },
      },
    },
  },
});

const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Rides Delivery API',
    version: '1.0.0',
    description:
      'Delivery backend that extends the Rides platform. Requests are authenticated with a JWT ' +
      'sent as "Authorization: Bearer <token>". Errors always use the same envelope: ' +
      'code, message, timestamp (and details when available).',
  },
  servers: [{ url: 'http://localhost:3000', description: 'Local development' }],
  tags: [
    { name: 'System', description: 'Service status' },
    { name: 'Driver preferences', description: 'Delivery categories a driver wants to see (Req 14)' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Check that the service is running',
        description: 'Public route. No token needed.',
        responses: {
          200: {
            description: 'Service is running',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    categories: { type: 'array', items: { $ref: '#/components/schemas/Category' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/drivers/me/category-preferences': {
      get: {
        tags: ['Driver preferences'],
        summary: 'Get my saved delivery categories',
        description:
          'Drivers only. An empty list means no preference is set, so all categories are shown (Req 14.7).',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'The driver\'s current preferences',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CategoryPreferences' },
              },
            },
          },
          401: errorResponse('Missing, invalid or expired token', 'UNAUTHORIZED', 'Missing or malformed Authorization header'),
          403: errorResponse('The user is not a driver', 'FORBIDDEN', 'This action requires the driver role'),
        },
      },
      put: {
        tags: ['Driver preferences'],
        summary: 'Save my delivery categories',
        description:
          'Drivers only. Replaces the saved list. Send an empty list to clear the preferences (Req 14.5, 14.6).',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['categories'],
                properties: {
                  categories: { type: 'array', items: { $ref: '#/components/schemas/Category' } },
                },
              },
              example: { categories: ['Parcel', 'Cargo'] },
            },
          },
        },
        responses: {
          200: {
            description: 'Preferences saved',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CategoryPreferences' },
              },
            },
          },
          400: errorResponse(
            'Invalid category or body',
            'VALIDATION_ERROR',
            'Invalid category: Pizza. Allowed: Parcel, Restaurant, Shop, Cargo'
          ),
          401: errorResponse('Missing, invalid or expired token', 'UNAUTHORIZED', 'Invalid or expired token'),
          403: errorResponse('The user is not a driver', 'FORBIDDEN', 'This action requires the driver role'),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste the JWT here (without the word "Bearer").',
      },
    },
    schemas: {
      Category: { type: 'string', enum: ['Parcel', 'Restaurant', 'Shop', 'Cargo'] },
      CategoryPreferences: {
        type: 'object',
        properties: {
          driverId: { type: 'string', example: 'driver-1' },
          categories: { type: 'array', items: { $ref: '#/components/schemas/Category' } },
          showingAll: { type: 'boolean', description: 'true when no categories are saved', example: false },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'UNAUTHORIZED' },
              message: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
              details: { type: 'object', description: 'Extra information when available' },
            },
          },
        },
      },
    },
  },
};

export default swaggerSpec;