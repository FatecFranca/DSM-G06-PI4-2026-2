const errorResponse = {
  description: 'Erro de validação ou operação',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
    },
  },
};

const auth = [{ bearerAuth: [] }];

const jsonRequest = (schema) => ({
  required: true,
  content: { 'application/json': { schema } },
});

const idParameter = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string' },
};

const openapiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Horta Comunitária API',
    version: '1.0.0',
    description: 'API de autenticação, colheitas, reservas, irrigação e telemetria da Horta Comunitária.',
  },
  servers: [{ url: 'http://localhost:3000', description: 'Desenvolvimento local' }],
  tags: [
    { name: 'Health', description: 'Disponibilidade do serviço' },
    { name: 'Autenticação', description: 'Cadastro e sessão de usuários' },
    { name: 'Usuários', description: 'Administração de usuários' },
    { name: 'Telemetria', description: 'Dados dos sensores e irrigação' },
    { name: 'Colheitas', description: 'Produção, calendário e reservas' },
    { name: 'Reservas', description: 'Gestão administrativa de reservas' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Verifica a disponibilidade da API',
        responses: { 200: { description: 'Serviço disponível' } },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Autenticação'],
        summary: 'Solicita cadastro de usuário',
        requestBody: jsonRequest({ $ref: '#/components/schemas/RegisterRequest' }),
        responses: { 201: { description: 'Cadastro criado' }, 409: errorResponse, 422: errorResponse, 503: errorResponse },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Autenticação'],
        summary: 'Inicia uma sessão',
        requestBody: jsonRequest({
          type: 'object',
          required: ['email', 'password'],
          properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', format: 'password' } },
        }),
        responses: { 200: { description: 'Sessão iniciada' }, 401: errorResponse, 403: errorResponse, 422: errorResponse },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Autenticação'],
        summary: 'Retorna o usuário autenticado',
        security: auth,
        responses: { 200: { description: 'Usuário e permissões' }, 401: errorResponse },
      },
    },
    '/auth/me/profile': {
      patch: {
        tags: ['Autenticação'],
        summary: 'Atualiza o próprio perfil',
        security: auth,
        requestBody: jsonRequest({ $ref: '#/components/schemas/ProfileRequest' }),
        responses: { 200: { description: 'Perfil atualizado' }, 401: errorResponse, 422: errorResponse },
      },
    },
    '/auth/me/password': {
      patch: {
        tags: ['Autenticação'],
        summary: 'Atualiza a própria senha',
        security: auth,
        requestBody: jsonRequest({
          type: 'object',
          required: ['currentPassword', 'password'],
          properties: {
            currentPassword: { type: 'string', format: 'password' },
            password: { type: 'string', format: 'password', minLength: 12 },
          },
        }),
        responses: { 200: { description: 'Senha atualizada' }, 401: errorResponse, 422: errorResponse },
      },
    },
    '/auth/forgot-password': {
      post: {
        tags: ['Autenticação'],
        summary: 'Solicita recuperação de senha',
        requestBody: jsonRequest({
          type: 'object',
          required: ['email'],
          properties: { email: { type: 'string', format: 'email' } },
        }),
        responses: { 200: { description: 'Solicitação processada' }, 422: errorResponse },
      },
    },
    '/auth/reset-password': {
      post: {
        tags: ['Autenticação'],
        summary: 'Redefine a senha com token',
        requestBody: jsonRequest({
          type: 'object',
          required: ['token', 'password', 'confirmPassword'],
          properties: {
            token: { type: 'string' },
            password: { type: 'string', format: 'password', minLength: 12 },
            confirmPassword: { type: 'string', format: 'password' },
          },
        }),
        responses: { 200: { description: 'Senha redefinida' }, 400: errorResponse, 422: errorResponse },
      },
    },
    '/users': {
      get: {
        tags: ['Usuários'],
        summary: 'Lista usuários',
        security: auth,
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'active', 'rejected', 'suspended'] } },
          { name: 'role', in: 'query', schema: { type: 'string', enum: ['resident', 'volunteer', 'collaborator', 'admin'] } },
        ],
        responses: { 200: { description: 'Lista de usuários' }, 401: errorResponse, 403: errorResponse },
      },
    },
    '/users/stats': {
      get: {
        tags: ['Usuários'],
        summary: 'Retorna estatísticas de usuários',
        security: auth,
        responses: { 200: { description: 'Estatísticas' }, 401: errorResponse, 403: errorResponse },
      },
    },
    '/users/audit': {
      get: {
        tags: ['Usuários'],
        summary: 'Lista o log de auditoria',
        security: auth,
        parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 } }],
        responses: { 200: { description: 'Logs de auditoria' }, 401: errorResponse, 403: errorResponse },
      },
    },
    '/users/{id}': {
      get: {
        tags: ['Usuários'],
        summary: 'Consulta um usuário',
        security: auth,
        parameters: [idParameter],
        responses: { 200: { description: 'Usuário' }, 401: errorResponse, 403: errorResponse, 404: errorResponse },
      },
      delete: {
        tags: ['Usuários'],
        summary: 'Exclui um usuário',
        security: auth,
        parameters: [idParameter],
        responses: { 204: { description: 'Usuário excluído' }, 401: errorResponse, 403: errorResponse, 404: errorResponse, 409: errorResponse },
      },
    },
    '/users/{id}/status': {
      patch: {
        tags: ['Usuários'],
        summary: 'Altera o status de um usuário',
        security: auth,
        parameters: [idParameter],
        requestBody: jsonRequest({ type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['active', 'rejected', 'suspended'] } } }),
        responses: { 200: { description: 'Status atualizado' }, 401: errorResponse, 403: errorResponse, 404: errorResponse, 409: errorResponse, 422: errorResponse },
      },
    },
    '/users/{id}/roles': {
      patch: {
        tags: ['Usuários'],
        summary: 'Altera os papéis de um usuário',
        security: auth,
        parameters: [idParameter],
        requestBody: jsonRequest({ type: 'object', required: ['roles'], properties: { roles: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', enum: ['resident', 'volunteer', 'collaborator', 'admin'] } } } }),
        responses: { 200: { description: 'Papéis atualizados' }, 401: errorResponse, 403: errorResponse, 404: errorResponse, 409: errorResponse, 422: errorResponse },
      },
    },
    '/users/{id}/profile': {
      patch: {
        tags: ['Usuários'],
        summary: 'Atualiza o perfil de um usuário',
        security: auth,
        parameters: [idParameter],
        requestBody: jsonRequest({ $ref: '#/components/schemas/ProfileRequest' }),
        responses: { 200: { description: 'Perfil atualizado' }, 401: errorResponse, 403: errorResponse, 404: errorResponse, 422: errorResponse },
      },
    },
    '/users/{id}/password': {
      patch: {
        tags: ['Usuários'],
        summary: 'Define uma senha para um usuário',
        security: auth,
        parameters: [idParameter],
        requestBody: jsonRequest({ type: 'object', required: ['password'], properties: { password: { type: 'string', format: 'password', minLength: 12 } } }),
        responses: { 200: { description: 'Senha atualizada' }, 401: errorResponse, 403: errorResponse, 404: errorResponse, 422: errorResponse },
      },
    },
    '/status': {
      get: {
        tags: ['Telemetria'],
        summary: 'Retorna telemetria atual e irrigação',
        security: auth,
        responses: { 200: { description: 'Status atual' }, 401: errorResponse },
      },
    },
    '/telemetry/history': {
      get: {
        tags: ['Telemetria'],
        summary: 'Consulta o histórico de telemetria',
        security: auth,
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 12, maximum: 120, default: 36 } },
          { name: 'hours', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 168, default: 24 } },
        ],
        responses: { 200: { description: 'Leituras de telemetria' }, 401: errorResponse },
      },
    },
    '/analytics/summary': {
      get: {
        tags: ['Telemetria'],
        summary: 'Calcula um resumo analítico',
        security: auth,
        parameters: [{ name: 'range', in: 'query', schema: { type: 'string', enum: ['24h', '7d', '30d'], default: '24h' } }],
        responses: { 200: { description: 'Resumo analítico' }, 401: errorResponse, 403: errorResponse },
      },
    },
    '/irrigation': {
      post: {
        tags: ['Telemetria'],
        summary: 'Controla a irrigação',
        security: auth,
        requestBody: jsonRequest({
          type: 'object',
          required: ['action'],
          properties: { action: { type: 'string', enum: ['on', 'off', 'auto'] }, mode: { type: 'string', enum: ['manual', 'automatic'], default: 'manual' } },
        }),
        responses: { 200: { description: 'Comando aplicado' }, 400: errorResponse, 401: errorResponse, 403: errorResponse, 502: errorResponse },
      },
    },
    '/harvest': {
      get: {
        tags: ['Colheitas'],
        summary: 'Lista colheitas',
        security: auth,
        responses: { 200: { description: 'Colheitas' }, 401: errorResponse },
      },
      post: {
        tags: ['Colheitas'],
        summary: 'Cadastra uma colheita',
        security: auth,
        requestBody: jsonRequest({ $ref: '#/components/schemas/HarvestRequest' }),
        responses: { 201: { description: 'Colheita criada' }, 401: errorResponse, 403: errorResponse, 422: errorResponse },
      },
    },
    '/harvest/calendar': {
      get: {
        tags: ['Colheitas'],
        summary: 'Consulta eventos do calendário',
        security: auth,
        parameters: [
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: { 200: { description: 'Eventos do calendário' }, 401: errorResponse, 422: errorResponse },
      },
    },
    '/harvest/mine': {
      get: {
        tags: ['Colheitas'],
        summary: 'Lista minhas reservas',
        security: auth,
        responses: { 200: { description: 'Reservas do usuário' }, 401: errorResponse, 403: errorResponse },
      },
    },
    '/harvest/dashboard': {
      get: {
        tags: ['Colheitas'],
        summary: 'Retorna totais do dashboard',
        security: auth,
        responses: { 200: { description: 'Totais da produção' }, 401: errorResponse, 403: errorResponse },
      },
    },
    '/harvest/{id}': {
      get: {
        tags: ['Colheitas'],
        summary: 'Consulta uma colheita',
        security: auth,
        parameters: [idParameter],
        responses: { 200: { description: 'Colheita' }, 401: errorResponse, 404: errorResponse },
      },
      patch: {
        tags: ['Colheitas'],
        summary: 'Atualiza uma colheita',
        security: auth,
        parameters: [idParameter],
        requestBody: jsonRequest({ $ref: '#/components/schemas/HarvestRequest' }),
        responses: { 200: { description: 'Colheita atualizada' }, 401: errorResponse, 403: errorResponse, 404: errorResponse, 422: errorResponse },
      },
      delete: {
        tags: ['Colheitas'],
        summary: 'Exclui uma colheita',
        security: auth,
        parameters: [idParameter],
        responses: { 204: { description: 'Colheita excluída' }, 401: errorResponse, 403: errorResponse, 404: errorResponse, 409: errorResponse },
      },
    },
    '/harvest/{id}/status': {
      patch: {
        tags: ['Colheitas'],
        summary: 'Altera o status de uma colheita',
        security: auth,
        parameters: [idParameter],
        requestBody: jsonRequest({ type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['planned', 'growing', 'ready', 'available', 'reserved', 'delivered', 'cancelled'] } } }),
        responses: { 200: { description: 'Status atualizado' }, 401: errorResponse, 403: errorResponse, 404: errorResponse, 422: errorResponse },
      },
    },
    '/harvest/{id}/reserve': {
      put: {
        tags: ['Colheitas'],
        summary: 'Reserva uma quantidade da colheita',
        security: auth,
        parameters: [idParameter],
        requestBody: jsonRequest({ type: 'object', properties: { quantity: { type: 'integer', minimum: 1, default: 1 } } }),
        responses: { 200: { description: 'Reserva criada' }, 401: errorResponse, 403: errorResponse, 404: errorResponse, 409: errorResponse, 422: errorResponse },
      },
    },
    '/harvest/{id}/cancel-reservation': {
      put: {
        tags: ['Colheitas'],
        summary: 'Cancela minha reserva',
        security: auth,
        parameters: [idParameter],
        responses: { 200: { description: 'Reserva cancelada' }, 401: errorResponse, 403: errorResponse, 404: errorResponse },
      },
    },
    '/reservations': {
      get: {
        tags: ['Reservas'],
        summary: 'Lista reservas para gestão',
        security: auth,
        parameters: [{ name: 'status', in: 'query', schema: { type: 'string', default: 'active', enum: ['active', 'all', 'history', 'cancelled', 'delivered', 'expired'] } }],
        responses: { 200: { description: 'Reservas' }, 401: errorResponse, 403: errorResponse },
      },
    },
    '/reservations/{id}/status': {
      patch: {
        tags: ['Reservas'],
        summary: 'Atualiza o status de uma reserva',
        security: auth,
        parameters: [idParameter],
        requestBody: jsonRequest({ type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['delivered', 'cancelled'] } } }),
        responses: { 200: { description: 'Reserva atualizada' }, 401: errorResponse, 403: errorResponse, 404: errorResponse, 422: errorResponse },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: { error: { type: 'string' }, code: { type: 'string' } },
      },
      ProfileRequest: {
        type: 'object',
        properties: {
          fullName: { type: 'string', minLength: 2 },
          email: { type: 'string', format: 'email' },
          cpf: { type: 'string' },
          phone: { type: 'string' },
          birthDate: { type: 'string', format: 'date' },
          address: { type: 'string' },
          emergencyContact: { type: 'string' },
          collaboratorProfile: { type: 'object' },
        },
      },
      RegisterRequest: {
        allOf: [
          { $ref: '#/components/schemas/ProfileRequest' },
          {
            type: 'object',
            required: ['password', 'confirmPassword', 'requestedRole'],
            properties: {
              password: { type: 'string', format: 'password', minLength: 12 },
              confirmPassword: { type: 'string', format: 'password' },
              requestedRole: { type: 'string', enum: ['resident', 'volunteer', 'collaborator'] },
              residentProfile: { type: 'object' },
            },
          },
        ],
      },
      HarvestRequest: {
        type: 'object',
        required: ['crop', 'harvestDate', 'quantity'],
        properties: {
          crop: { type: 'string' },
          category: { type: 'string', default: 'other' },
          status: { type: 'string', enum: ['planned', 'growing', 'ready', 'available', 'reserved', 'delivered', 'cancelled'] },
          plantingDate: { type: 'string', format: 'date-time' },
          harvestDate: { type: 'string', format: 'date-time' },
          quantity: { type: 'number', exclusiveMinimum: 0 },
          unit: { type: 'string', default: 'unidade' },
          notes: { type: 'string' },
        },
      },
    },
  },
};

export default openapiDocument;
