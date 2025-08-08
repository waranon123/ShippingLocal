import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { sign, verify } from 'hono/jwt'  // แก้ไข: ใช้ named imports
import bcrypt from 'bcryptjs'


const app = new Hono()

// Fixed CORS Middleware
app.use('*', cors({
  origin: ['https://eaa129ad.truck-management-frontend.pages.dev', 'http://localhost:3000', 'http://localhost:5173'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}))

// Utility functions
const generateId = () => crypto.randomUUID()
const getCurrentTimestamp = () => new Date().toISOString()

// Auth middleware - แก้ไข: ใช้ verify แทน jwt.verify
const createAuthMiddleware = (requiredRole = 'viewer') => {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization')
    
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ detail: 'Could not validate credentials' }, 401)
    }

    try {
      const token = authHeader.replace('Bearer ', '')
      const payload = await verify(token, c.env.JWT_SECRET)  // แก้ไข: ใช้ verify
      
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return c.json({ detail: 'Token expired' }, 401)
      }

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

// Root endpoint
app.get('/', (c) => {
  return c.json({
    message: "Truck Management System API - Cloudflare Workers",
    version: "2.0.0",
    database: "D1 SQLite",
    status: "online",
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

// Health check
// แทนที่ health endpoint เดิมด้วยอันนี้
app.get('/health', async (c) => {
  try {
    const db = c.env.DB
    if (!db) {
      return c.json({
        status: "unhealthy",
        database: "D1 not available",
        error: "Database binding not found",
        timestamp: getCurrentTimestamp()
      }, 500)
    }
    
    // Simple test query first
    try {
      const testResult = await db.prepare("SELECT 1 as test").first()
      if (!testResult || testResult.test !== 1) {
        throw new Error('Database test query failed')
      }
    } catch (dbTestError) {
      return c.json({
        status: "unhealthy",
        database: "connection failed",
        error: dbTestError.message,
        timestamp: getCurrentTimestamp()
      }, 500)
    }

    // Try to get truck count
    let truckCount = 0
    try {
      const countResult = await db.prepare("SELECT COUNT(*) as count FROM trucks").first()
      truckCount = countResult?.count || 0
    } catch (countError) {
      console.log('Could not get truck count:', countError.message)
      // Don't fail health check just for this
    }
    
    return c.json({
      status: "healthy",
      database: "connected",
      truck_count: truckCount,
      timestamp: getCurrentTimestamp()
    })
    
  } catch (error) {
    console.error('Health check error:', error)
    return c.json({
      status: "unhealthy",
      database: "error",
      error: error.message,
      timestamp: getCurrentTimestamp()
    }, 500)
  }
})

// Login endpoint - Fixed for form data and JSON
// แทนที่ login endpoint เดิมด้วยอันนี้
app.post('/api/auth/login', async (c) => {
  try {
    const contentType = c.req.header('content-type') || ''
    let username, password

    console.log('Login request received:', {
      contentType,
      method: c.req.method,
      url: c.req.url
    })

    // Handle different content types
    if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      try {
        const formData = await c.req.formData()
        username = formData.get('username')
        password = formData.get('password')
        console.log('Form data parsed:', { username, password, hasPassword: !!password })
      } catch (formError) {
        console.error('Form parsing error:', formError)
        return c.json({ detail: 'Invalid form data' }, 400)
      }
    } else if (contentType.includes('application/json')) {
      try {
        const body = await c.req.json()
        username = body.username
        password = body.password
        console.log('JSON data parsed:', { username, hasPassword: !!password })
      } catch (jsonError) {
        console.error('JSON parsing error:', jsonError)
        return c.json({ 
          detail: 'Invalid JSON format', 
          error: jsonError.message
        }, 400)
      }
    } else {
      // Try to parse as JSON anyway (fallback)
      try {
        const body = await c.req.json()
        username = body.username
        password = body.password
        console.log('Fallback JSON parsing successful:', { username, hasPassword: !!password })
      } catch (error) {
        console.error('No supported content type, trying text:', contentType)
        const rawText = await c.req.text()
        console.log('Raw request body:', rawText.substring(0, 200))
        return c.json({ 
          detail: 'Unsupported content type. Use application/json or multipart/form-data',
          received_content_type: contentType
        }, 400)
      }
    }

    // Validate credentials
    if (!username || !password) {
      console.log('Missing credentials:', { username: !!username, password: !!password })
      return c.json({ 
        detail: 'Username and password required',
        received: { username: !!username, password: !!password }
      }, 400)
    }

    const db = c.env.DB
    if (!db) {
      console.error('Database not available')
      return c.json({ detail: 'Database not available' }, 500)
    }

    // Find user
    const user = await db.prepare(
      "SELECT * FROM users WHERE username = ?"
    ).bind(username).first()

    console.log('User lookup result:', { 
      username, 
      userFound: !!user,
      userId: user?.id,
      userRole: user?.role 
    })

    if (!user) {
      console.log('User not found:', username)
      return c.json({ detail: "Incorrect username or password" }, 401)
    }

    // Password validation
    let isValid = false
    
    // Check for demo credentials first
    if (username === 'admin' && password === 'admin123') {
      isValid = true
      console.log('Demo admin login successful')
    } else if (username === 'user' && password === 'user123') {
      isValid = true
      console.log('Demo user login successful')
    } else if (username === 'viewer' && password === 'viewer123') {
      isValid = true
      console.log('Demo viewer login successful')
    } else {
      // Try bcrypt for hashed passwords
      try {
        if (typeof bcrypt !== 'undefined' && bcrypt.compare) {
          isValid = await bcrypt.compare(password, user.password_hash)
          console.log('BCrypt password verification:', isValid)
        } else {
          console.log('BCrypt not available, checking plain text')
          isValid = false
        }
      } catch (bcryptError) {
        console.error('BCrypt error:', bcryptError)
        isValid = false
      }
    }

    if (!isValid) {
      console.log('Password validation failed for user:', username, 'with password length:', password.length)
      return c.json({ detail: "Incorrect username or password" }, 401)
    }

    // Generate JWT
    const expirationMinutes = parseInt(c.env.JWT_EXPIRATION_MINUTES || '60')
    const payload = {
      sub: user.username,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + (expirationMinutes * 60)
    }

    console.log('Generating JWT for user:', { username: user.username, role: user.role })

    const token = await sign(payload, c.env.JWT_SECRET)  // แก้ไข: ใช้ sign แทน jwt.sign

    console.log('Login successful for user:', username)

    return c.json({
      access_token: token,
      token_type: "bearer",
      role: user.role
    })

  } catch (error) {
    console.error('Login error:', error)
    return c.json({ 
      detail: 'Login failed: ' + error.message,
      error: error.name
    }, 500)
  }
})

// Guest login
app.post('/api/auth/guest-login', async (c) => {
  try {
    const expirationMinutes = parseInt(c.env.JWT_EXPIRATION_MINUTES || '60')
    const payload = {
      sub: "guest_viewer",
      role: "viewer",
      is_guest: true,
      exp: Math.floor(Date.now() / 1000) + (expirationMinutes * 60)
    }

    const token = await sign(payload, c.env.JWT_SECRET)  // แก้ไข: ใช้ sign

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

// Get trucks
app.get('/api/trucks', createAuthMiddleware('viewer'), async (c) => {
  try {
    const db = c.env.DB
    if (!db) {
      return c.json({ detail: 'Database not available' }, 500)
    }

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
    return c.json({ detail: 'Failed to fetch trucks: ' + error.message }, 500)
  }
})

// Get stats
app.get('/api/stats', createAuthMiddleware('viewer'), async (c) => {
  try {
    const db = c.env.DB
    if (!db) {
      return c.json({ detail: 'Database not available' }, 500)
    }

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

    // Get basic stats
    const totalResult = await db.prepare(
      `SELECT COUNT(*) as count FROM trucks ${whereClause}`
    ).bind(...params).first()

    // Return simple stats
    return c.json({
      total_trucks: totalResult?.count || 0,
      preparation_stats: { 'On Process': 0, 'Delay': 0, 'Finished': 0 },
      loading_stats: { 'On Process': 0, 'Delay': 0, 'Finished': 0 },
      terminal_stats: {}
    })

  } catch (error) {
    console.error('Stats error:', error)
    return c.json({ detail: 'Failed to fetch stats: ' + error.message }, 500)
  }
})

// Create truck
app.post('/api/trucks', createAuthMiddleware('user'), async (c) => {
  try {
    const truckData = await c.req.json()
    const db = c.env.DB

    if (!db) {
      return c.json({ detail: 'Database not available' }, 500)
    }

    // Validate required fields
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
    return c.json({ detail: 'Failed to create truck: ' + error.message }, 500)
  }
})

export default app