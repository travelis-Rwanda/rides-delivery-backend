import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { CATEGORIES } from './constants.js';
import routes from './routes.js';
import { errorHandler } from './errors.js';
import swaggerSpec from './swagger.js';
import devTokenRoutes, { devTokenDoc } from './devTokenRoute.js';

const app = express();


app.use(express.json());


const devTokenEnabled = process.env.ENABLE_DEV_TOKEN === 'true' && process.env.NODE_ENV !== 'production';
if (devTokenEnabled) {
  swaggerSpec.tags.push({ name: 'Development helper', description: 'Test tokens (not part of the real API)' });
  swaggerSpec.paths['/auth/dev-token'] = devTokenDoc;
  app.use(devTokenRoutes);
}

// API documentation: the page at /api-docs, and the raw OpenAPI file at /api-docs.json
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', categories: CATEGORIES });
});

app.use(routes);


app.use(errorHandler);

export default app;