import { Hono } from 'hono'
import { cors } from 'hono/cors'
import bcrypt from 'bcryptjs'
import { read, utils } from 'xlsx'
import * as ExcelJS from 'exceljs'
const app = new Hono()

// In-memory session storage (in production, use KV)
const importSessions = {}

// CORS Middleware - Fixed for production
app.use('*', cors({
  origin: (origin) => {
    const allowedPatterns = [
      /https:\/\/.*\.pages\.dev$/,
      /https:\/\/.*\.cloudflare\.com$/,
      'http://localhost:3000',
      'http://localhost:5173',
      'https://eaa129ad.truck-management-frontend.pages.dev'
    ]
    
    if (!origin) return '*'
    
    return allowedPatterns.some(pattern => 
      typeof pattern === 'string' ? pattern === origin : pattern.test(origin)
    ) ? origin : null
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}))

// Utility functions
const generateId = () => crypto.randomUUID()
const getCurrentTimestamp = () => new Date().toISOString()

// Simple JWT implementation for Workers
const base64urlEscape = (str) => {
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

const createJWT = async (payload, secret) => {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  }
  
  const encodedHeader = base64urlEscape(btoa(JSON.stringify(header)))
  const encodedPayload = base64urlEscape(btoa(JSON.stringify(payload)))
  
  const data = `${encodedHeader}.${encodedPayload}`
  
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data)
  )
  
  const encodedSignature = base64urlEscape(btoa(String.fromCharCode(...new Uint8Array(signature))))
  
  return `${data}.${encodedSignature}`
}

const verifyJWT = async (token, secret) => {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.')
    
    if (!headerB64 || !payloadB64 || !signatureB64) {
      throw new Error('Invalid token format')
    }
    
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')))
    
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired')
    }
    
    return payload
  } catch (error) {
    throw new Error('Invalid token: ' + error.message)
  }
}

// Auth middleware
const createAuthMiddleware = (requiredRole = 'viewer') => {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization')
    
    console.log('Auth check:', {
      hasAuthHeader: !!authHeader,
      authHeader: authHeader ? authHeader.substring(0, 20) + '...' : null,
      requiredRole,
      jwtSecret: c.env.JWT_SECRET ? 'present' : 'missing'
    })
    
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('No valid bearer token found')
      return c.json({ detail: 'Could not validate credentials - no bearer token' }, 401)
    }

    try {
      const token = authHeader.replace('Bearer ', '')
      console.log('Attempting to verify token...')
      
      const payload = await verifyJWT(token, c.env.JWT_SECRET)
      console.log('Token verified successfully:', { user: payload.sub, role: payload.role, exp: payload.exp })
      
      const roleHierarchy = { viewer: 0, user: 1, admin: 2 }
      const userRole = payload.role || 'viewer'
      
      if (roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
        console.log('Insufficient permissions:', { userRole, requiredRole })
        return c.json({ detail: 'Not enough permissions' }, 403)
      }

      c.set('user', payload)
      await next()
    } catch (error) {
      console.error('Auth error:', error)
      return c.json({ 
        detail: 'Could not validate credentials - ' + error.message,
        debug: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }, 401)
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
      stats: "/api/stats",
      importTemplate: "/api/trucks/template",
      importPreview: "/api/trucks/import/preview",
      importConfirm: "/api/trucks/import/confirm"
    },
    default_login: {
      username: "admin",
      password: "admin123"
    }
  })
})

// Health check
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
    
    const testResult = await db.prepare("SELECT 1 as test").first()
    if (!testResult || testResult.test !== 1) {
      throw new Error('Database test query failed')
    }

    let truckCount = 0
    try {
      const countResult = await db.prepare("SELECT COUNT(*) as count FROM trucks").first()
      truckCount = countResult?.count || 0
    } catch (countError) {
      console.log('Could not get truck count:', countError.message)
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

// Login endpoint
app.post('/api/auth/login', async (c) => {
  try {
    const contentType = c.req.header('content-type') || ''
    let username, password

    console.log('Login request received:', {
      contentType,
      method: c.req.method,
      url: c.req.url
    })

    if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await c.req.formData()
      username = formData.get('username')
      password = formData.get('password')
    } else {
      try {
        const body = await c.req.json()
        username = body.username
        password = body.password
      } catch (jsonError) {
        const formData = await c.req.formData()
        username = formData.get('username')
        password = formData.get('password')
      }
    }

    if (!username || !password) {
      return c.json({ 
        detail: 'Username and password required'
      }, 400)
    }

    const db = c.env.DB
    if (!db) {
      console.error('Database not available')
      return c.json({ detail: 'Database not available' }, 500)
    }

    let user = null
    let isValid = false

    if (username === 'admin' && password === 'admin123') {
      user = {
        id: 'admin-demo',
        username: 'admin',
        role: 'admin',
        password_hash: 'demo'
      }
      isValid = true
    } else if (username === 'user' && password === 'user123') {
      user = {
        id: 'user-demo',
        username: 'user',
        role: 'user',
        password_hash: 'demo'
      }
      isValid = true
    } else if (username === 'viewer' && password === 'viewer123') {
      user = {
        id: 'viewer-demo',
        username: 'viewer',
        role: 'viewer',
        password_hash: 'demo'
      }
      isValid = true
    } else {
      user = await db.prepare(
        "SELECT * FROM users WHERE username = ?"
      ).bind(username).first()

      if (user) {
        try {
          isValid = await bcrypt.compare(password, user.password_hash)
        } catch (bcryptError) {
          console.error('BCrypt error:', bcryptError)
          isValid = false
        }
      }
    }

    if (!user || !isValid) {
      console.log('Invalid credentials for user:', username)
      return c.json({ detail: "Incorrect username or password" }, 401)
    }

    const expirationMinutes = parseInt(c.env.JWT_EXPIRATION_MINUTES || '60')
    const payload = {
      sub: user.username,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + (expirationMinutes * 60)
    }

    const token = await createJWT(payload, c.env.JWT_SECRET)

    console.log('Login successful for user:', username)

    return c.json({
      access_token: token,
      token_type: "bearer",
      role: user.role
    })

  } catch (error) {
    console.error('Login error:', error)
    return c.json({ 
      detail: 'Login failed: ' + error.message
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

    const token = await createJWT(payload, c.env.JWT_SECRET)

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

// Get all trucks
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

// Create truck
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

    let sql = 'SELECT id, terminal, shipping_no, dock_code, truck_route, preparation_start, preparation_end, loading_start, loading_end, status_preparation, status_loading, created_at, updated_at FROM trucks WHERE 1=1'
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

    // Format time fields if they exist
    const formattedResults = result.results.map(truck => ({
      ...truck,
      preparation_start: truck.preparation_start || '',
      preparation_end: truck.preparation_end || '',
      loading_start: truck.loading_start || '',
      loading_end: truck.loading_end || ''
    }));

    return c.json(formattedResults || [])

  } catch (error) {
    console.error('Get trucks error:', error)
    return c.json({ detail: 'Failed to fetch trucks: ' + error.message }, 500)
  }
})


// Update truck
app.put('/api/trucks/:id', createAuthMiddleware('user'), async (c) => {
  try {
    const id = c.req.param('id')
    const truckData = await c.req.json()
    const db = c.env.DB

    if (!db) {
      return c.json({ detail: 'Database not available' }, 500)
    }

    const updateFields = []
    const params = []

    const allowedFields = [
      'terminal', 'shipping_no', 'dock_code', 'truck_route',
      'preparation_start', 'preparation_end', 'loading_start', 'loading_end',
      'status_preparation', 'status_loading'
    ]

    for (const field of allowedFields) {
      if (truckData[field] !== undefined) {
        updateFields.push(`${field} = ?`)
        params.push(truckData[field])
      }
    }

    if (updateFields.length === 0) {
      return c.json({ detail: 'No fields to update' }, 400)
    }

    updateFields.push('updated_at = ?')
    params.push(getCurrentTimestamp())
    params.push(id)

    const sql = `UPDATE trucks SET ${updateFields.join(', ')} WHERE id = ?`
    const result = await db.prepare(sql).bind(...params).run()

    if (result.changes === 0) {
      return c.json({ detail: 'Truck not found' }, 404)
    }

    const updatedTruck = await db.prepare(
      "SELECT * FROM trucks WHERE id = ?"
    ).bind(id).first()

    return c.json(updatedTruck)

  } catch (error) {
    console.error('Update truck error:', error)
    return c.json({ detail: 'Failed to update truck: ' + error.message }, 500)
  }
})

// Delete truck
app.delete('/api/trucks/:id', createAuthMiddleware('admin'), async (c) => {
  try {
    const id = c.req.param('id')
    const db = c.env.DB

    if (!db) {
      return c.json({ detail: 'Database not available' }, 500)
    }

    const result = await db.prepare(
      "DELETE FROM trucks WHERE id = ?"
    ).bind(id).run()

    if (result.changes === 0) {
      return c.json({ detail: 'Truck not found' }, 404)
    }

    return c.json({ message: 'Truck deleted successfully' })

  } catch (error) {
    console.error('Delete truck error:', error)
    return c.json({ detail: 'Failed to delete truck: ' + error.message }, 500)
  }
})

// Get statistics
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

    const totalResult = await db.prepare(
      `SELECT COUNT(*) as count FROM trucks ${whereClause}`
    ).bind(...params).first()

    const prepResult = await db.prepare(`
      SELECT status_preparation, COUNT(*) as count 
      FROM trucks ${whereClause} 
      GROUP BY status_preparation
    `).bind(...params).all()

    const loadResult = await db.prepare(`
      SELECT status_loading, COUNT(*) as count 
      FROM trucks ${whereClause} 
      GROUP BY status_loading
    `).bind(...params).all()

    const terminalResult = await db.prepare(`
      SELECT terminal, COUNT(*) as count 
      FROM trucks ${whereClause} 
      GROUP BY terminal
    `).bind(...params).all()

    const preparationStats = { 'On Process': 0, 'Delay': 0, 'Finished': 0 }
    const loadingStats = { 'On Process': 0, 'Delay': 0, 'Finished': 0 }
    const terminalStats = {}

    prepResult.results?.forEach(row => {
      if (row.status_preparation) {
        preparationStats[row.status_preparation] = row.count
      }
    })

    loadResult.results?.forEach(row => {
      if (row.status_loading) {
        loadingStats[row.status_loading] = row.count
      }
    })

    terminalResult.results?.forEach(row => {
      if (row.terminal) {
        terminalStats[row.terminal] = row.count
      }
    })

    return c.json({
      total_trucks: totalResult?.count || 0,
      preparation_stats: preparationStats,
      loading_stats: loadingStats,
      terminal_stats: terminalStats
    })

  } catch (error) {
    console.error('Stats error:', error)
    return c.json({ detail: 'Failed to fetch stats: ' + error.message }, 500)
  }
})

// Download import template
app.get('/api/trucks/template', createAuthMiddleware('viewer'), async (c) => {
  try {
    console.log('📋 Template download requested by:', c.get('user')?.sub)
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Template');

    // Define headers to match Python code
    worksheet.columns = [
      { header: 'Month', key: 'month' },
      { header: 'Terminal', key: 'terminal' },
      { header: 'Shipping No', key: 'shipping_no' },
      { header: 'Dock Code', key: 'dock_code' },
      { header: 'Route', key: 'route' },
      { header: 'Prep Start', key: 'prep_start' },
      { header: 'Prep End', key: 'prep_end' },
      { header: 'Load Start', key: 'load_start' },
      { header: 'Load End', key: 'load_end' },
      { header: 'Status Prep', key: 'status_prep' },
      { header: 'Status Load', key: 'status_load' }
    ];

    // Add header formatting
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2196F3' }
      };
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' }
      };
      cell.alignment = { horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Set column widths
    worksheet.getColumn('A').width = 12; // Month
    worksheet.getColumn('B').width = 12; // Terminal
    worksheet.getColumn('C').width = 12; // Shipping No
    worksheet.getColumn('D').width = 12; // Dock Code
    worksheet.getColumn('E').width = 20; // Route
    worksheet.getColumn('F').width = 12; // Prep Start
    worksheet.getColumn('G').width = 12; // Prep End
    worksheet.getColumn('H').width = 12; // Load Start
    worksheet.getColumn('I').width = 12; // Load End
    worksheet.getColumn('J').width = 12; // Status Prep
    worksheet.getColumn('K').width = 12; // Status Load

    // Add sample data
    worksheet.addRows([
      ['2024-01', 'A', 'SHP001', 'DOCK-A1', 'Bangkok-Chonburi', '08:00', '08:30', '09:00', '10:00', 'Finished', 'Finished'],
      ['2024-02', 'B', 'SHP002', 'DOCK-B1', 'Bangkok-Rayong', '09:00', '09:30', '10:00', '', 'Finished', 'On Process'],
      ['2024-03', 'C', 'SHP003', 'DOCK-C1', 'Bangkok-Pattaya', '10:00', '', '', '', 'On Process', 'On Process']
    ]);

    // Add instructions sheet
    const instructions = workbook.addWorksheet('Instructions');
    instructions.getCell('A1').value = 'Monthly Import Instructions:';
    instructions.getCell('A1').font = { bold: true, size: 14 };
    instructions.getCell('A3').value = '1. Fill in the Template sheet with your monthly truck data';
    instructions.getCell('A4').value = '2. Required fields: Month, Terminal, Shipping No, Dock Code, Route';
    instructions.getCell('A5').value = '3. Month format: YYYY-MM (e.g., 2024-01 for January 2024)';
    instructions.getCell('A6').value = '4. Optional fields: Time fields and Status fields';
    instructions.getCell('A7').value = '5. Valid status values: "On Process", "Delay", "Finished"';
    instructions.getCell('A8').value = '6. Time format: HH:MM (24-hour format)';
    instructions.getCell('A9').value = '7. Each row will create daily records for the entire month';
    instructions.getCell('A10').value = '8. Save the file and upload through the Management page';

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    console.log('✅ Template generated, size:', buffer.byteLength, 'bytes');
    
    // Return Excel file with proper headers
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="truck_monthly_import_template.xlsx"',
        'Content-Length': buffer.byteLength.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Expose-Headers': 'Content-Disposition'
      }
    });
    
  } catch (error) {
    console.error('❌ Template generation error:', error)
    return c.json({ 
      detail: 'Failed to generate template: ' + error.message,
      timestamp: getCurrentTimestamp()
    }, 500)
  }
});

// Alternative: Return template as JSON with base64 encoded Excel-like structure
app.get('/api/trucks/template/json', createAuthMiddleware('viewer'), async (c) => {
  try {
    const template = {
      headers: [
        'Month',
        'Terminal', 
        'Shipping No',
        'Dock Code',
        'Route',
        'Prep Start',
        'Prep End',
        'Load Start',
        'Load End',
        'Status Prep',
        'Status Load'
      ],
      sample_data: [
        {
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
      ],
      instructions: {
        monthly_import: 'Each row creates daily records for the entire month',
        date_format: 'YYYY-MM (e.g., 2024-01 for January 2024)',
        time_format: 'HH:MM (24-hour format)',
        status_values: ['On Process', 'Delay', 'Finished']
      }
    }
    
    return c.json(template)
    
  } catch (error) {
    console.error('❌ Template JSON error:', error)
    return c.json({ detail: 'Failed to generate template JSON: ' + error.message }, 500)
  }
})

// Debug endpoint (no auth required)
app.get('/api/trucks/template/debug', async (c) => {
  try {
    console.log('🔧 Debug template endpoint called')
    
    return c.json({
      message: 'Template debug endpoint working',
      timestamp: getCurrentTimestamp(),
      headers: Object.fromEntries(c.req.raw.headers.entries()),
      method: c.req.method,
      url: c.req.url,
      available_endpoints: [
        'GET /api/trucks/template - Download Excel template (requires auth)',
        'GET /api/trucks/export - Export data as CSV (requires auth)',
        'GET /api/trucks/template/json - Get template as JSON (requires auth)',
        'GET /api/trucks/template/debug - This debug endpoint (no auth)'
      ]
    })
    
  } catch (error) {
    console.error('Debug error:', error)
    return c.json({ detail: 'Debug failed: ' + error.message }, 500)
  }
})

// Export trucks as CSV
app.get('/api/trucks/export', createAuthMiddleware('viewer'), async (c) => {
  try {
    console.log('📊 Export requested by:', c.get('user')?.sub)
    
    const db = c.env.DB
    if (!db) {
      return c.json({ detail: 'Database not available' }, 500)
    }

    const query = c.req.query()
    const {
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

    sql += ' ORDER BY created_at DESC'

    const stmt = db.prepare(sql)
    const result = await stmt.bind(...params).all()
    const trucks = result.results || []

    // Generate CSV export
    const headers = [
      'ID',
      'Terminal', 
      'Shipping No',
      'Dock Code',
      'Truck Route',
      'Prep Start',
      'Prep End', 
      'Loading Start',
      'Loading End',
      'Prep Status',
      'Loading Status',
      'Created Date',
      'Updated Date'
    ]
    
    const csvRows = trucks.map(truck => [
      truck.id,
      truck.terminal,
      truck.shipping_no,
      truck.dock_code,
      truck.truck_route,
      truck.preparation_start || '',
      truck.preparation_end || '',
      truck.loading_start || '',
      truck.loading_end || '',
      truck.status_preparation,
      truck.status_loading,
      truck.created_at?.split('T')[0] || '',
      truck.updated_at?.split('T')[0] || ''
    ])
    
    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => row.map(cell => 
        (cell.toString().includes(',') || cell === '') ? `"${cell}"` : cell.toString()
      ).join(','))
    ].join('\n')
    
    // Add BOM for Excel compatibility
    const bom = '\uFEFF'
    const finalContent = bom + csvContent
    
    console.log('✅ Export generated:', trucks.length, 'records,', finalContent.length, 'bytes')
    
    return new Response(finalContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="trucks_export_${new Date().toISOString().split('T')[0]}.csv"`,
        'Content-Length': finalContent.length.toString(),
        'Cache-Control': 'no-cache',
        'Access-Control-Expose-Headers': 'Content-Disposition'
      }
    })

  } catch (error) {
    console.error('❌ Export error:', error)
    return c.json({ detail: 'Export failed: ' + error.message }, 500)
  }
})

// Preview Excel import
app.post('/api/trucks/import/preview', createAuthMiddleware('user'), async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('file')
    
    if (!file || !file.name.match(/\.(xlsx|xls)$/)) {
      return c.json({ detail: 'File must be Excel format (.xlsx or .xls)' }, 400)
    }

    const arrayBuffer = await file.arrayBuffer()
    const workbook = read(new Uint8Array(arrayBuffer))
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = utils.sheet_to_json(worksheet)

    const requiredColumns = {
      'Month': 'month',
      'Terminal': 'terminal',
      'Shipping No': 'shipping_no',
      'Dock Code': 'dock_code',
      'Route': 'truck_route'
    }

    const optionalColumns = {
      'Prep Start': 'preparation_start',
      'Prep End': 'preparation_end',
      'Load Start': 'loading_start',
      'Load End': 'loading_end',
      'Status Prep': 'status_preparation',
      'Status Load': 'status_loading'
    }

    const columns = Object.keys(data[0] || {})
    const missingCols = Object.keys(requiredColumns).filter(col => !columns.includes(col))
    if (missingCols.length > 0) {
      return c.json({ detail: `Missing required columns: ${missingCols.join(', ')}` }, 400)
    }

    const trucksPreview = []
    const errors = []
    let totalRecordsToCreate = 0

    data.forEach((row, index) => {
      try {
        const truckTemplate = {}

        // Validate month
        const monthStr = row['Month']?.toString().trim()
        if (!monthStr || monthStr === '') {
          errors.push(`Row ${index + 2}: Month is required`)
          return
        }

        try {
          const [year, month] = monthStr.split('-').map(Number)
          if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
            throw new Error('Invalid month format')
          }
          
          truckTemplate.year = year
          truckTemplate.month = month

          // Calculate days in month
          const daysInMonth = new Date(year, month, 0).getDate()
          totalRecordsToCreate += daysInMonth
        } catch (e) {
          errors.push(`Row ${index + 2}: Month must be in format YYYY-MM (e.g., 2024-01)`)
          return
        }

        // Process required columns
        for (const [excelCol, dbCol] of Object.entries(requiredColumns)) {
          if (excelCol === 'Month') continue
          const value = row[excelCol]?.toString().trim()
          if (!value || value === '') {
            errors.push(`Row ${index + 2}: ${excelCol} is required`)
            return
          }
          truckTemplate[dbCol] = value
        }

        // Process optional columns, ensuring time fields are formatted as HH:MM
        for (const [excelCol, dbCol] of Object.entries(optionalColumns)) {
          if (excelCol in row) {
            const value = row[excelCol]
            if (value !== undefined && value !== '' && !isNaN(value)) {
              if (['preparation_start', 'preparation_end', 'loading_start', 'loading_end'].includes(dbCol)) {
                // Handle time fields (ensure HH:MM format)
                try {
                  if (typeof value === 'object' && value instanceof Date) {
                    truckTemplate[dbCol] = value.toTimeString().slice(0, 5); // Format as HH:MM
                  } else {
                    const timeStr = value.toString().trim();
                    const [hours, minutes] = timeStr.split(':');
                    if (hours && minutes && !isNaN(hours) && !isNaN(minutes)) {
                      truckTemplate[dbCol] = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
                    } else {
                      truckTemplate[dbCol] = timeStr; // Fallback to original if invalid
                    }
                  }
                } catch (e) {
                  truckTemplate[dbCol] = value.toString().trim();
                }
              } else {
                truckTemplate[dbCol] = value.toString().trim();
              }
            } else {
              truckTemplate[dbCol] = null;
            }
          }
        }

        // Set default statuses
        truckTemplate.status_preparation = truckTemplate.status_preparation || 'On Process'
        truckTemplate.status_loading = truckTemplate.status_loading || 'On Process'

        // Validate statuses
        const validStatuses = ['On Process', 'Delay', 'Finished']
        if (!validStatuses.includes(truckTemplate.status_preparation)) {
          truckTemplate.status_preparation = 'On Process'
        }
        if (!validStatuses.includes(truckTemplate.status_loading)) {
          truckTemplate.status_loading = 'On Process'
        }

        const previewTruck = { ...truckTemplate, preview_days: new Date(truckTemplate.year, truckTemplate.month, 0).getDate() }
        trucksPreview.push(previewTruck)

      } catch (e) {
        errors.push(`Row ${index + 2}: ${e.message}`)
      }
    })

    const sessionId = generateId()
    importSessions[sessionId] = {
      truck_templates: trucksPreview,
      user_id: c.get('user').sub,
      timestamp: new Date(),
      total_records_to_create: totalRecordsToCreate
    }

    return c.json({
      success: true,
      session_id: sessionId,
      preview: trucksPreview.slice(0, 10),
      total_templates: trucksPreview.length,
      total_records_to_create: totalRecordsToCreate,
      errors,
      columns_found: columns,
      message: `Will create ${totalRecordsToCreate} daily records from ${trucksPreview.length} monthly templates`
    })

  } catch (error) {
    console.error('Import preview error:', error)
    return c.json({ detail: `Error reading Excel file: ${error.message}` }, 400)
  }
})

// Confirm Excel import (ensure time fields are preserved)
app.post('/api/trucks/import/confirm', createAuthMiddleware('user'), async (c) => {
  try {
    const { session_id } = await c.req.json()
    const session = importSessions[session_id]

    if (!session) {
      return c.json({ detail: 'Import session not found or expired' }, 400)
    }

    if (session.user_id !== c.get('user').sub) {
      return c.json({ detail: 'Unauthorized' }, 403)
    }

    const db = c.env.DB
    if (!db) {
      return c.json({ detail: 'Database not available' }, 500)
    }

    const truckTemplates = session.truck_templates
    let importedCount = 0
    const failedImports = []

    for (const [templateIndex, truckTemplate] of truckTemplates.entries()) {
      try {
        const year = truckTemplate.year
        const month = truckTemplate.month
        const daysInMonth = new Date(year, month, 0).getDate()
        const baseShippingNo = truckTemplate.shipping_no

        for (let day = 1; day <= daysInMonth; day++) {
          try {
            const recordDate = new Date(year, month - 1, day).toISOString().split('T')[0]
            
            // Check for existing record
            const existing = await db.prepare(`
              SELECT id FROM trucks 
              WHERE shipping_no = ? AND DATE(created_at) = ?
            `).bind(baseShippingNo, recordDate).first()

            const truckData = {
              id: existing ? existing.id : generateId(),
              terminal: truckTemplate.terminal,
              shipping_no: baseShippingNo,
              dock_code: truckTemplate.dock_code,
              truck_route: truckTemplate.truck_route,
              preparation_start: truckTemplate.preparation_start,
              preparation_end: truckTemplate.preparation_end,
              loading_start: truckTemplate.loading_start,
              loading_end: truckTemplate.loading_end,
              status_preparation: truckTemplate.status_preparation,
              status_loading: truckTemplate.status_loading,
              created_at: recordDate,
              updated_at: getCurrentTimestamp()
            }

            if (existing) {
              // Update existing record
              const updateFields = []
              const params = []

              for (const [key, value] of Object.entries(truckData)) {
                if (key !== 'id' && value !== undefined) {
                  updateFields.push(`${key} = ?`)
                  params.push(value)
                }
              }
              params.push(existing.id)

              await db.prepare(`
                UPDATE trucks SET ${updateFields.join(', ')} WHERE id = ?
              `).bind(...params).run()
            } else {
              // Create new record
              await db.prepare(`
                INSERT INTO trucks (
                  id, terminal, shipping_no, dock_code, truck_route,
                  preparation_start, preparation_end, loading_start, loading_end,
                  status_preparation, status_loading, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(
                truckData.id,
                truckData.terminal,
                truckData.shipping_no,
                truckData.dock_code,
                truckData.truck_route,
                truckData.preparation_start,
                truckData.preparation_end,
                truckData.loading_start,
                truckData.loading_end,
                truckData.status_preparation,
                truckData.status_loading,
                truckData.created_at,
                truckData.updated_at
              ).run()
            }

            importedCount++
            
          } catch (dayError) {
            failedImports.push({
              template: templateIndex + 1,
              day,
              shipping_no: baseShippingNo,
              error: dayError.message
            })
          }
        }
      } catch (templateError) {
        failedImports.push({
          template: templateIndex + 1,
          shipping_no: truckTemplate.shipping_no || 'Unknown',
          error: templateError.message
        })
      }
    }

    // Clean up session
    delete importSessions[session_id]

    return c.json({
      success: true,
      imported: importedCount,
      failed: failedImports.length,
      failed_details: failedImports,
      message: `Successfully imported ${importedCount} daily records from monthly templates`
    })

  } catch (error) {
    console.error('Import confirm error:', error)
    return c.json({ detail: `Import failed: ${error.message}` }, 500)
  }
})

// Register new user
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
    if (!db) {
      return c.json({ detail: 'Database not available' }, 500)
    }
    
    const existingUser = await db.prepare(
      "SELECT username FROM users WHERE username = ?"
    ).bind(username).first()

    if (existingUser) {
      return c.json({ detail: 'Username already exists' }, 400)
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const userId = generateId()

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
    return c.json({ detail: 'Failed to create user: ' + error.message }, 500)
  }
})

// Get all users
app.get('/api/users', createAuthMiddleware('admin'), async (c) => {
  try {
    const db = c.env.DB
    if (!db) {
      return c.json({ detail: 'Database not available' }, 500)
    }

    const users = await db.prepare(
      "SELECT id, username, role, created_at FROM users"
    ).all()

    return c.json(users.results || [])

  } catch (error) {
    console.error('Get users error:', error)
    return c.json({ detail: 'Failed to fetch users' }, 500)
  }
})

// Delete user
app.delete('/api/users/:id', createAuthMiddleware('admin'), async (c) => {
  try {
    const id = c.req.param('id')
    const db = c.env.DB

    if (!db) {
      return c.json({ detail: 'Database not available' }, 500)
    }

    const result = await db.prepare(
      "DELETE FROM users WHERE id = ?"
    ).bind(id).run()

    if (result.changes === 0) {
      return c.json({ detail: 'User not found' }, 404)
    }

    return c.json({ message: 'User deleted successfully' })

  } catch (error) {
    console.error('Delete user error:', error)
    return c.json({ detail: 'Failed to delete user: ' + error.message }, 500)
  }
})

// Parameterized routes (placed after specific routes)
app.get('/api/trucks/:id', createAuthMiddleware('viewer'), async (c) => {
  try {
    const db = c.env.DB
    if (!db) {
      return c.json({ detail: 'Database not available' }, 500)
    }

    const id = c.req.param('id')
    const truck = await db.prepare(
      "SELECT * FROM trucks WHERE id = ?"
    ).bind(id).first()

    if (!truck) {
      return c.json({ detail: 'Truck not found' }, 404)
    }

    return c.json(truck)

  } catch (error) {
    console.error('Get truck error:', error)
    return c.json({ detail: 'Failed to fetch truck' }, 500)
  }
})

// Update truck status
app.patch('/api/trucks/:id/status', createAuthMiddleware('user'), async (c) => {
  try {
    const id = c.req.param('id')
    const query = c.req.query()
    const { status_type, status } = query

    if (!['preparation', 'loading'].includes(status_type)) {
      return c.json({ detail: 'Invalid status type' }, 400)
    }

    if (!['On Process', 'Delay', 'Finished'].includes(status)) {
      return c.json({ detail: 'Invalid status value' }, 400)
    }

    const db = c.env.DB
    if (!db) {
      return c.json({ detail: 'Database not available' }, 500)
    }

    const statusColumn = status_type === 'preparation' ? 'status_preparation' : 'status_loading'

    const result = await db.prepare(`
      UPDATE trucks 
      SET ${statusColumn} = ?, updated_at = ?
      WHERE id = ?
    `).bind(status, getCurrentTimestamp(), id).run()

    if (result.changes === 0) {
      return c.json({ detail: 'Truck not found' }, 404)
    }

    const updatedTruck = await db.prepare(
      "SELECT * FROM trucks WHERE id = ?"
    ).bind(id).first()

    return c.json(updatedTruck)

  } catch (error) {
    console.error('Update status error:', error)
    return c.json({ detail: 'Failed to update status' }, 500)
  }
})

export default app