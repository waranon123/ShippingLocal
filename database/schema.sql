// backend-workers/src/index.js
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { jwt } from 'hono/jwt'
import { bearerAuth } from 'hono/bearer-auth'
import bcrypt from 'bcryptjs'

const app = new Hono()

// CORS Middleware
app.use('*', cors({
  origin: (origin) => {
    // Allow Pages domains and localhost for development
    const allowedOrigins = [
      /https:\/\/.*\.pages\.dev$/,
      /https:\/\/.*\.cloudflare\.com$/,
      'http://localhost:3000',
      'http://localhost:5173'
    ]
    
    if (!origin) return true // Allow same-origin requests
    
    return allowedOrigins.some(pattern => 
      typeof pattern === 'string' ? pattern === origin : pattern.test(origin)
    )
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}))

// JWT Middleware
const createAuthMiddleware = (requiredRole = 'viewer') => {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization')
    
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ detail: 'Could not validate credentials' }, 401)
    }

    try {
      const token = authHeader.replace('Bearer ', '')
      const payload = await jwt.verify(token, c.env.JWT_SECRET)
      
      // Check if token is expired
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return c.json({ detail: 'Token expired' }, 401)
      }

      // Check role permissions
      const roleHierarchy = { viewer: 0, user: 1, admin: 2 }
      const userRole = payload.role || 'viewer'
      
      if (roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
        return c.json({ detail: 'Not enough permissions' }, 403)
      }

      c.set('user', payload)
      await next()
    } catch (error) {
      console.error('Auth error:', error)
      return c.json({ detail: 'Could not validate credentials' }, 401)
    }
  }
}

// Utility functions
const generateId = () => crypto.randomUUID()
const getCurrentTimestamp = () => new Date().toISOString()

// Routes

// Root endpoint - แปลงจาก FastAPI
app.get('/', (c) => {
  return c.json({
    message: "Truck Management System API - Cloudflare Workers",
    version: "2.0.0",
    database: "D1 SQLite",
    status: "online",
    docs: "Available at /docs (coming soon)",
    health: "/health",
    endpoints: {
      auth: "/api/auth/login",
      trucks: "/api/trucks",
      stats: "/api/stats"
    },
    default_login: {
      username: "admin",
      password: "admin123"
    }
  })
})

// Health check - แปลงจาก Python
app.get('/health', async (c) => {
  try {
    const db = c.env.DB
    const result = await db.prepare("SELECT COUNT(*) as count FROM trucks").first()
    
    return c.json({
      status: "healthy",
      database: "connected",
      truck_count: result?.count || 0,
      timestamp: getCurrentTimestamp()
    })
  } catch (error) {
    return c.json({
      status: "unhealthy",
      database: "disconnected",
      error: error.message,
      timestamp: getCurrentTimestamp()
    }, 500)
  }
})

// Auth endpoints - แปลงจาก FastAPI OAuth2PasswordRequestForm
app.post('/api/auth/login', async (c) => {
  try {
    const contentType = c.req.header('content-type')
    let username, password

    if (contentType?.includes('application/x-www-form-urlencoded')) {
      // Handle form data like FastAPI OAuth2PasswordRequestForm
      const formData = await c.req.formData()
      username = formData.get('username')
      password = formData.get('password')
    } else {
      // Handle JSON data
      const body = await c.req.json()
      username = body.username
      password = body.password
    }

    if (!username || !password) {
      return c.json({ detail: 'Username and password required' }, 400)
    }

    const db = c.env.DB
    const user = await db.prepare(
      "SELECT * FROM users WHERE username = ?"
    ).bind(username).first()

    if (!user) {
      return c.json({ 
        detail: "Incorrect username or password" 
      }, 401)
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash)
    if (!isValid) {
      return c.json({ 
        detail: "Incorrect username or password" 
      }, 401)
    }

    // Generate JWT - เหมือน FastAPI
    const expirationMinutes = parseInt(c.env.JWT_EXPIRATION_MINUTES || '60')
    const payload = {
      sub: user.username,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + (expirationMinutes * 60)
    }

    const token = await jwt.sign(payload, c.env.JWT_SECRET)

    return c.json({
      access_token: token,
      token_type: "bearer",
      role: user.role
    })

  } catch (error) {
    console.error('Login error:', error)
    return c.json({ detail: 'Login failed' }, 500)
  }
})

// Guest login - เหมือน FastAPI
app.post('/api/auth/guest-login', async (c) => {
  try {
    const expirationMinutes = parseInt(c.env.JWT_EXPIRATION_MINUTES || '60')
    const payload = {
      sub: "guest_viewer",
      role: "viewer",
      is_guest: true,
      exp: Math.floor(Date.now() / 1000) + (expirationMinutes * 60)
    }

    const token = await jwt.sign(payload, c.env.JWT_SECRET)

    return c.json({
      access_token: token,
      token_type: "bearer",
      role: "viewer"
    })
  } catch (error) {
    console.error('Guest login error:', error)
    return c.json({ detail: 'Guest login failed' }, 500)
  }
})

// User registration - แปลงจาก FastAPI
app.post('/api/auth/register', createAuthMiddleware('admin'), async (c) => {
  try {
    const { username, password, role = 'user' } = await c.req.json()

    if (!username || !password) {
      return c.json({ detail: 'Username and password required' }, 400)
    }

    const validRoles = ['viewer', 'user', 'admin']
    if (!validRoles.includes(role)) {
      return c.json({ detail: 'Invalid role' }, 400)
    }

    const db = c.env.DB
    
    // Check if user exists
    const existingUser = await db.prepare(
      "SELECT username FROM users WHERE username = ?"
    ).bind(username).first()

    if (existingUser) {
      return c.json({ detail: 'Username already exists' }, 400)
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)
    const userId = generateId()

    // Create user
    const result = await db.prepare(`
      INSERT INTO users (id, username, password_hash, role, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(userId, username, passwordHash, role, getCurrentTimestamp()).run()

    if (result.success) {
      return c.json({
        success: true,
        message: `User '${username}' created successfully`,
        user: {
          id: userId,
          username,
          role
        }
      })
    } else {
      throw new Error('Failed to create user')
    }

  } catch (error) {
    console.error('Registration error:', error)
    return c.json({ detail: 'Failed to create user' }, 500)
  }
})

// Get trucks - แปลงจาก FastAPI query parameters
app.get('/api/trucks', createAuthMiddleware('viewer'), async (c) => {
  try {
    const db = c.env.DB
    const query = c.req.query()
    
    const {
      skip = '0',
      limit = '100',
      terminal,
      status_preparation,
      status_loading,
      date_from,
      date_to
    } = query

    let sql = 'SELECT * FROM trucks WHERE 1=1'
    const params = []

    if (terminal) {
      sql += ' AND terminal = ?'
      params.push(terminal)
    }

    if (status_preparation) {
      sql += ' AND status_preparation = ?'
      params.push(status_preparation)
    }

    if (status_loading) {
      sql += ' AND status_loading = ?'
      params.push(status_loading)
    }

    if (date_from) {
      sql += ' AND DATE(created_at) >= ?'
      params.push(date_from)
    }

    if (date_to) {
      sql += ' AND DATE(created_at) <= ?'
      params.push(date_to)
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(parseInt(limit), parseInt(skip))

    const stmt = db.prepare(sql)
    const result = await stmt.bind(...params).all()

    return c.json(result.results || [])

  } catch (error) {
    console.error('Get trucks error:', error)
    return c.json({ detail: 'Failed to fetch trucks' }, 500)
  }
})

// Create truck - แปลงจาก FastAPI Pydantic models
app.post('/api/trucks', createAuthMiddleware('user'), async (c) => {
  try {
    const truckData = await c.req.json()
    const db = c.env.DB

    // Validate required fields (เหมือน Pydantic validation)
    const requiredFields = ['terminal', 'shipping_no', 'dock_code', 'truck_route']
    for (const field of requiredFields) {
      if (!truckData[field]) {
        return c.json({ detail: `${field} is required` }, 400)
      }
    }

    const id = generateId()
    const now = getCurrentTimestamp()

    const result = await db.prepare(`
      INSERT INTO trucks (
        id, terminal, shipping_no, dock_code, truck_route,
        preparation_start, preparation_end, loading_start, loading_end,
        status_preparation, status_loading, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      truckData.terminal,
      truckData.shipping_no,
      truckData.dock_code,
      truckData.truck_route,
      truckData.preparation_start || null,
      truckData.preparation_end || null,
      truckData.loading_start || null,
      truckData.loading_end || null,
      truckData.status_preparation || 'On Process',
      truckData.status_loading || 'On Process',
      now,
      now
    ).run()

    if (result.success) {
      const newTruck = await db.prepare(
        "SELECT * FROM trucks WHERE id = ?"
      ).bind(id).first()
      
      return c.json(newTruck, 201)
    } else {
      throw new Error('Failed to create truck')
    }

  } catch (error) {
    console.error('Create truck error:', error)
    return c.json({ detail: 'Failed to create truck' }, 500)
  }
})

// Update truck status - แปลงจาก FastAPI PATCH
app.patch('/api/trucks/:truck_id/status', createAuthMiddleware('user'), async (c) => {
  try {
    const truckId = c.req.param('truck_id')
    const query = c.req.query()
    const { status_type, status } = query

    if (!['preparation', 'loading'].includes(status_type)) {
      return c.json({ detail: 'Invalid status type' }, 400)
    }

    if (!['On Process', 'Delay', 'Finished'].includes(status)) {
      return c.json({ detail: 'Invalid status value' }, 400)
    }

    const db = c.env.DB
    const statusColumn = status_type === 'preparation' ? 'status_preparation' : 'status_loading'

    const result = await db.prepare(`
      UPDATE trucks 
      SET ${statusColumn} = ?, updated_at = ?
      WHERE id = ?
    `).bind(status, getCurrentTimestamp(), truckId).run()

    if (result.changes === 0) {
      return c.json({ detail: 'Truck not found' }, 404)
    }

    const updatedTruck = await db.prepare(
      "SELECT * FROM trucks WHERE id = ?"
    ).bind(truckId).first()

    return c.json(updatedTruck)

  } catch (error) {
    console.error('Update status error:', error)
    return c.json({ detail: 'Failed to update status' }, 500)
  }
})

// Get stats - แปลงจาก FastAPI
app.get('/api/stats', createAuthMiddleware('viewer'), async (c) => {
  try {
    const db = c.env.DB
    const query = c.req.query()
    const { terminal, date_from, date_to } = query

    let whereClause = 'WHERE 1=1'
    const params = []

    if (terminal) {
      whereClause += ' AND terminal = ?'
      params.push(terminal)
    }

    if (date_from) {
      whereClause += ' AND DATE(created_at) >= ?'
      params.push(date_from)
    }

    if (date_to) {
      whereClause += ' AND DATE(created_at) <= ?'
      params.push(date_to)
    }

    // Total trucks
    const totalResult = await db.prepare(
      `SELECT COUNT(*) as count FROM trucks ${whereClause}`
    ).bind(...params).first()

    // Preparation stats
    const prepResult = await db.prepare(`
      SELECT status_preparation, COUNT(*) as count 
      FROM trucks ${whereClause} 
      GROUP BY status_preparation
    `).bind(...params).all()

    // Loading stats  
    const loadResult = await db.prepare(`
      SELECT status_loading, COUNT(*) as count 
      FROM trucks ${whereClause} 
      GROUP BY status_loading
    `).bind(...params).all()

    // Terminal stats
    const terminalResult = await db.prepare(`
      SELECT terminal, COUNT(*) as count 
      FROM trucks ${whereClause} 
      GROUP BY terminal
    `).bind(...params).all()

    const preparationStats = { 'On Process': 0, 'Delay': 0, 'Finished': 0 }
    const loadingStats = { 'On Process': 0, 'Delay': 0, 'Finished': 0 }
    const terminalStats = {}

    prepResult.results?.forEach(row => {
      preparationStats[row.status_preparation] = row.count
    })

    loadResult.results?.forEach(row => {
      loadingStats[row.status_loading] = row.count
    })

    terminalResult.results?.forEach(row => {
      terminalStats[row.terminal] = row.count
    })

    return c.json({
      total_trucks: totalResult?.count || 0,
      preparation_stats: preparationStats,
      loading_stats: loadingStats,
      terminal_stats: terminalStats
    })

  } catch (error) {
    console.error('Stats error:', error)
    return c.json({ detail: 'Failed to fetch stats' }, 500)
  }
})

// Export template - Simple version
app.get('/api/trucks/template', createAuthMiddleware('viewer'), async (c) => {
  // For now, return JSON template data
  // TODO: Implement Excel generation in Workers
  const templateData = {
    message: "Excel template generation coming soon",
    sample_data: {
      'Month': '2024-01',
      'Terminal': 'A',
      'Shipping No': 'SHP001',
      'Dock Code': 'DOCK-A1',
      'Route': 'Bangkok-Chonburi',
      'Prep Start': '08:00',
      'Prep End': '08:30',
      'Load Start': '09:00',
      'Load End': '10:00',
      'Status Prep': 'Finished',
      'Status Load': 'Finished'
    }
  }
  
  return c.json(templateData)
})

export default app