import pandas as pd
from fastapi import UploadFile, File, Response, FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from jose import JWTError, jwt
import bcrypt
import os
from dotenv import load_dotenv
import json
import uuid
import io
import xlsxwriter
from sqlalchemy import and_
import math

from .models import Truck, User, create_tables, get_db
from .schemas import TruckCreate, TruckUpdate, Token, UserResponse, Truck as TruckSchema

# Load environment variables
load_dotenv()

# Create tables on startup
create_tables()

app = FastAPI(title="Truck Management System API - Local Database")

# CORS - อัปเดตให้รองรับ ngrok และ tunnel services
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173", 
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "https://*.vercel.app",
        "https://*.ngrok-free.app",  # Ngrok domains
        "https://*.ngrok.io",        # Legacy ngrok
        "https://*.loca.lt",         # LocalTunnel
        "https://*.localhost.run",   # Alternative tunnel
        "*"  # Allow all for development (remove in production)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback-secret-key-for-dev")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRATION_MINUTES = int(os.getenv("JWT_EXPIRATION_MINUTES", "60"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

# WebSocket Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
    
    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except:
                pass

manager = ConnectionManager()
import_sessions = {}

# Helper function to clean data for JSON serialization
def clean_for_json(data):
    """Clean data to make it JSON compliant"""
    if isinstance(data, dict):
        return {k: clean_for_json(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [clean_for_json(item) for item in data]
    elif isinstance(data, float):
        if math.isnan(data) or math.isinf(data):
            return None
        return data
    elif pd.isna(data):
        return None
    else:
        return data
def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise credentials_exception
    
    return UserResponse(id=user.id, username=user.username, role=user.role)

def check_permission(required_role: str):
    def permission_checker(current_user: UserResponse = Depends(get_current_user)):
        role_hierarchy = {"viewer": 0, "user": 1, "admin": 2}
        if role_hierarchy.get(current_user.role, 0) < role_hierarchy.get(required_role, 0):
            raise HTTPException(
                status_code=403,
                detail="Not enough permissions"
            )
        return current_user
    return permission_checker

# Initialize default admin user
def init_default_user():
    db = SessionLocal()
    try:
        existing_user = db.query(User).filter(User.username == "admin").first()
        if not existing_user:
            admin_user = User(
                username="admin",
                password_hash=get_password_hash("admin123"),
                role="admin"
            )
            db.add(admin_user)
            db.commit()
            print("✅ Default admin user created (admin/admin123)")
    except Exception as e:
        print(f"❌ Error creating default user: {e}")
    finally:
        db.close()

# Call init function
from .models import SessionLocal
init_default_user()

# Routes
@app.get("/")
def read_root():
    return {
        "message": "Truck Management System API - Local Database",
        "version": "2.0.0",
        "database": "SQLite Local",
        "status": "online",
        "docs": "/docs",
        "health": "/health",
        "endpoints": {
            "auth": "/api/auth/login",
            "trucks": "/api/trucks",
            "stats": "/api/stats",
            "websocket": "/ws"
        },
        "default_login": {
            "username": "admin",
            "password": "admin123"
        }
    }

@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    try:
        truck_count = db.query(Truck).count()
        return {
            "status": "healthy",
            "database": "connected",
            "truck_count": truck_count,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }

@app.post("/api/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=JWT_EXPIRATION_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role
    }

# Add user registration endpoint
@app.post("/api/auth/register")
async def register_user(
    username: str,
    password: str,
    role: str = "user",
    current_user: UserResponse = Depends(check_permission("admin")),
    db: Session = Depends(get_db)
):
    """Register new user (admin only)"""
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.username == username).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already exists")
        
        # Validate role
        valid_roles = ["viewer", "user", "admin"]
        if role not in valid_roles:
            raise HTTPException(status_code=400, detail="Invalid role")
        
        # Create new user
        new_user = User(
            id=str(uuid.uuid4()),
            username=username,
            password_hash=get_password_hash(password),
            role=role
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        return {
            "success": True,
            "message": f"User '{username}' created successfully",
            "user": {
                "id": new_user.id,
                "username": new_user.username,
                "role": new_user.role
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create user: {str(e)}")

# Add guest login endpoint
@app.post("/api/auth/guest-login", response_model=Token)
async def guest_login():
    """Login as guest viewer (no authentication required)"""
    try:
        # Create temporary guest token
        guest_data = {
            "sub": "guest_viewer",
            "role": "viewer",
            "is_guest": True
        }
        
        access_token_expires = timedelta(minutes=JWT_EXPIRATION_MINUTES)
        access_token = create_access_token(
            data=guest_data,
            expires_delta=access_token_expires
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "role": "viewer"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Guest login failed: {str(e)}")

# Update get_current_user to handle guest tokens
async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role", "viewer")
        is_guest: bool = payload.get("is_guest", False)
        
        if username is None:
            raise credentials_exception
            
        # Handle guest user
        if is_guest and username == "guest_viewer":
            return UserResponse(id="guest", username="Guest Viewer", role="viewer")
        
        # Handle regular user
        user = db.query(User).filter(User.username == username).first()
        if not user:
            raise credentials_exception
        
        return UserResponse(id=user.id, username=user.username, role=user.role)
        
    except JWTError:
        raise credentials_exception

# Add users management endpoints
@app.get("/api/users")
async def get_users(
    current_user: UserResponse = Depends(check_permission("admin")),
    db: Session = Depends(get_db)
):
    """Get all users (admin only)"""
    users = db.query(User).all()
    return [
        {
            "id": user.id,
            "username": user.username,
            "role": user.role,
            "created_at": user.created_at.isoformat()
        }
        for user in users
    ]

@app.delete("/api/users/{user_id}")
async def delete_user(
    user_id: str,
    current_user: UserResponse = Depends(check_permission("admin")),
    db: Session = Depends(get_db)
):
    """Delete user (admin only)"""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db.delete(user)
    db.commit()
    
    return {"message": f"User '{user.username}' deleted successfully"}

@app.get("/api/trucks", response_model=List[TruckSchema])
async def get_trucks(
    skip: int = 0,
    limit: int = 100,
    terminal: Optional[str] = None,
    status_preparation: Optional[str] = None,
    status_loading: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Truck)
    
    if terminal:
        query = query.filter(Truck.terminal == terminal)
    if status_preparation:
        query = query.filter(Truck.status_preparation == status_preparation)
    if status_loading:
        query = query.filter(Truck.status_loading == status_loading)
    if date_from:
        date_from_dt = f"{date_from} 00:00:00"
        query = query.filter(Truck.created_at >= date_from_dt)
    if date_to:
        date_to_dt = f"{date_to} 23:59:59"
        query = query.filter(Truck.created_at <= date_to_dt)
    
    trucks = query.order_by(Truck.created_at.desc()).offset(skip).limit(limit).all()
    
    # Clean trucks data for JSON response
    trucks_data = []
    for truck in trucks:
        truck_dict = {
            "id": truck.id,
            "terminal": truck.terminal,
            "shipping_no": truck.shipping_no,
            "dock_code": truck.dock_code,
            "truck_route": truck.truck_route,
            "preparation_start": truck.preparation_start,
            "preparation_end": truck.preparation_end,
            "loading_start": truck.loading_start,
            "loading_end": truck.loading_end,
            "status_preparation": truck.status_preparation,
            "status_loading": truck.status_loading,
            "created_at": truck.created_at.isoformat(),
            "updated_at": truck.updated_at.isoformat() if truck.updated_at else None
        }
        trucks_data.append(clean_for_json(truck_dict))
    
    return trucks_data

@app.get("/api/stats")
async def get_stats(
    terminal: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Truck)
    
    if terminal:
        query = query.filter(Truck.terminal == terminal)
    if date_from:
        date_from_dt = f"{date_from} 00:00:00"
        query = query.filter(Truck.created_at >= date_from_dt)
    if date_to:
        date_to_dt = f"{date_to} 23:59:59"
        query = query.filter(Truck.created_at <= date_to_dt)
    
    trucks = query.all()
    
    # Calculate statistics
    total_trucks = len(trucks)
    preparation_stats = {"On Process": 0, "Delay": 0, "Finished": 0}
    loading_stats = {"On Process": 0, "Delay": 0, "Finished": 0}
    terminal_stats = {}
    
    for truck in trucks:
        # Preparation stats
        prep_status = truck.status_preparation or "On Process"
        if prep_status in preparation_stats:
            preparation_stats[prep_status] += 1
        
        # Loading stats
        load_status = truck.status_loading or "On Process"
        if load_status in loading_stats:
            loading_stats[load_status] += 1
        
        # Terminal stats
        term = truck.terminal or "Unknown"
        terminal_stats[term] = terminal_stats.get(term, 0) + 1
    
    return clean_for_json({
        "total_trucks": total_trucks,
        "preparation_stats": preparation_stats,
        "loading_stats": loading_stats,
        "terminal_stats": terminal_stats
    })

@app.post("/api/trucks", response_model=TruckSchema)
async def create_truck(
    truck: TruckCreate,
    current_user: UserResponse = Depends(check_permission("user")),
    db: Session = Depends(get_db)
):
    # Validate status fields
    valid_statuses = ['On Process', 'Delay', 'Finished']
    if truck.status_preparation not in valid_statuses:
        truck.status_preparation = 'On Process'
    if truck.status_loading not in valid_statuses:
        truck.status_loading = 'On Process'

    try:
        # Create new truck
        db_truck = Truck(**truck.dict())
        db_truck.id = str(uuid.uuid4())
        db_truck.created_at = datetime.utcnow()
        
        db.add(db_truck)
        db.commit()
        db.refresh(db_truck)
        
        # Clean and return truck data
        truck_data = {
            "id": db_truck.id,
            "terminal": db_truck.terminal,
            "shipping_no": db_truck.shipping_no,
            "dock_code": db_truck.dock_code,
            "truck_route": db_truck.truck_route,
            "preparation_start": db_truck.preparation_start,
            "preparation_end": db_truck.preparation_end,
            "loading_start": db_truck.loading_start,
            "loading_end": db_truck.loading_end,
            "status_preparation": db_truck.status_preparation,
            "status_loading": db_truck.status_loading,
            "created_at": db_truck.created_at.isoformat(),
            "updated_at": db_truck.updated_at.isoformat() if db_truck.updated_at else None
        }
        
        clean_truck_data = clean_for_json(truck_data)
        
        # Broadcast update via WebSocket
        await manager.broadcast({
            "type": "truck_created",
            "data": clean_truck_data
        })
        
        return clean_truck_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating truck: {str(e)}")

@app.get("/api/trucks/template")
async def download_import_template():
    template_data = {
        'Terminal': ['A', 'B', 'C'],
        'Shipping No': ['SHP001', 'SHP002', 'SHP003'],  # Changed from Truck No
        'Dock Code': ['DOCK-A1', 'DOCK-B1', 'DOCK-C1'],
        'Route': ['Bangkok-Chonburi', 'Bangkok-Rayong', 'Bangkok-Pattaya'],
        'Prep Start': ['08:00', '09:00', '10:00'],
        'Prep End': ['08:30', '09:30', ''],
        'Load Start': ['09:00', '10:00', ''],
        'Load End': ['10:00', '', ''],
        'Status Prep': ['Finished', 'Finished', 'On Process'],
        'Status Load': ['Finished', 'On Process', 'On Process']
    }
    
    df = pd.DataFrame(template_data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        df.to_excel(writer, sheet_name='Template', index=False)
        workbook = writer.book
        worksheet = writer.sheets['Template']
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#2196F3',
            'font_color': 'white',
            'border': 1,
            'align': 'center'
        })
        instructions = workbook.add_worksheet('Instructions')
        instructions.write('A1', 'Import Instructions:', workbook.add_format({'bold': True, 'size': 14}))
        instructions.write('A3', '1. Fill in the Template sheet with your truck data')
        instructions.write('A4', '2. Required fields: Terminal, Shipping No, Dock Code, Route')  # Updated
        instructions.write('A5', '3. Optional fields: Time fields and Status fields')
        instructions.write('A6', '4. Valid status values: "On Process", "Delay", "Finished"')
        instructions.write('A7', '5. Time format: HH:MM (24-hour format)')
        instructions.write('A8', '6. Save the file and upload through the Management page')
        for col_num, value in enumerate(df.columns.values):
            worksheet.write(0, col_num, value, header_format)
        worksheet.set_column('A:A', 12)
        worksheet.set_column('B:B', 12)
        worksheet.set_column('C:C', 12)
        worksheet.set_column('D:D', 20)
        worksheet.set_column('E:E', 12)
        worksheet.set_column('F:F', 12)
        worksheet.set_column('G:G', 12)
        worksheet.set_column('H:H', 12)
        worksheet.set_column('I:I', 12)
        worksheet.set_column('J:J', 12)
    
    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': 'attachment; filename=truck_import_template.xlsx'}
    )

@app.get("/api/trucks/export")
async def export_trucks_excel(
    terminal: Optional[str] = None,
    status_preparation: Optional[str] = None,
    status_loading: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Truck)
    
    if terminal:
        query = query.filter(Truck.terminal == terminal)
    if status_preparation:
        query = query.filter(Truck.status_preparation == status_preparation)
    if status_loading:
        query = query.filter(Truck.status_loading == status_loading)
    if date_from:
        date_from_dt = f"{date_from} 00:00:00"
        query = query.filter(Truck.created_at >= date_from_dt)
    if date_to:
        date_to_dt = f"{date_to} 23:59:59"
        query = query.filter(Truck.created_at <= date_to_dt)
        
    trucks = query.all()
    
    # Convert to list of dicts
    trucks_data = []
    for truck in trucks:
        trucks_data.append({
            'terminal': truck.terminal,
            'shipping_no': truck.shipping_no,  # Changed from truck_no
            'dock_code': truck.dock_code,
            'truck_route': truck.truck_route,
            'preparation_start': truck.preparation_start,
            'preparation_end': truck.preparation_end,
            'loading_start': truck.loading_start,
            'loading_end': truck.loading_end,
            'status_preparation': truck.status_preparation,
            'status_loading': truck.status_loading,
            'created_at': truck.created_at.isoformat(),
            'updated_at': truck.updated_at.isoformat() if truck.updated_at else None
        })
    
    df = pd.DataFrame(trucks_data)
    
    column_mapping = {
        'terminal': 'Terminal',
        'shipping_no': 'Shipping No',  # Changed from truck_no
        'dock_code': 'Dock Code',
        'truck_route': 'Route',
        'preparation_start': 'Prep Start',
        'preparation_end': 'Prep End',
        'loading_start': 'Load Start',
        'loading_end': 'Load End',
        'status_preparation': 'Status Prep',
        'status_loading': 'Status Load',
        'created_at': 'Created Date',
        'updated_at': 'Last Updated'
    }
    
    df = df.rename(columns=column_mapping)
    export_columns = [
        'Terminal', 'Shipping No', 'Dock Code', 'Route',  # Updated column name
        'Prep Start', 'Prep End', 'Load Start', 'Load End',
        'Status Prep', 'Status Load', 'Created Date', 'Last Updated'
    ]
    export_columns = [col for col in export_columns if col in df.columns]
    df = df[export_columns]
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        df.to_excel(writer, sheet_name='Trucks', index=False)
        workbook = writer.book
        worksheet = writer.sheets['Trucks']
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#4CAF50',
            'font_color': 'white',
            'border': 1
        })
        for col_num, value in enumerate(df.columns.values):
            worksheet.write(0, col_num, value, header_format)
        for i, col in enumerate(df.columns):
            column_width = max(df[col].astype(str).map(len).max(), len(col)) + 2
            worksheet.set_column(i, i, column_width)
    
    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={
            'Content-Disposition': f'attachment; filename=trucks_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
        }
    )

@app.post("/api/trucks/import/preview")
async def preview_excel_import(
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(check_permission("user"))
):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(400, "File must be Excel format (.xlsx or .xls)")
    
    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        required_columns = {
            'Terminal': 'terminal',
            'Shipping No': 'shipping_no',  # Changed from Truck No
            'Dock Code': 'dock_code',
            'Route': 'truck_route'
        }
        
        missing_cols = [col for col in required_columns.keys() if col not in df.columns]
        if missing_cols:
            raise HTTPException(400, f"Missing required columns: {', '.join(missing_cols)}")
        
        optional_columns = {
            'Prep Start': 'preparation_start',
            'Prep End': 'preparation_end',
            'Load Start': 'loading_start',
            'Load End': 'loading_end',
            'Status Prep': 'status_preparation',
            'Status Load': 'status_loading'
        }
        
        trucks_preview = []
        errors = []
        
        for index, row in df.iterrows():
            try:
                truck = {}
                for excel_col, db_col in required_columns.items():
                    value = row.get(excel_col, '')
                    if pd.isna(value) or str(value).strip() == '':
                        errors.append(f"Row {index + 2}: {excel_col} is required")
                        continue
                    truck[db_col] = str(value).strip()
                
                for excel_col, db_col in optional_columns.items():
                    if excel_col in df.columns:
                        value = row.get(excel_col)
                        if not pd.isna(value):
                            if 'start' in db_col or 'end' in db_col:
                                try:
                                    if isinstance(value, datetime):
                                        truck[db_col] = value.strftime('%H:%M')
                                    else:
                                        truck[db_col] = str(value)
                                except:
                                    truck[db_col] = str(value)
                            else:
                                truck[db_col] = str(value)
                        else:
                            truck[db_col] = None
                
                if 'status_preparation' not in truck:
                    truck['status_preparation'] = 'On Process'
                if 'status_loading' not in truck:
                    truck['status_loading'] = 'On Process'
                
                valid_statuses = ['On Process', 'Delay', 'Finished']
                if truck.get('status_preparation') not in valid_statuses:
                    truck['status_preparation'] = 'On Process'
                if truck.get('status_loading') not in valid_statuses:
                    truck['status_loading'] = 'On Process'
                
                trucks_preview.append(truck)
                
            except Exception as e:
                errors.append(f"Row {index + 2}: {str(e)}")
        
        session_id = str(uuid.uuid4())
        import_sessions[session_id] = {
            'trucks': trucks_preview,
            'user_id': current_user.id,
            'timestamp': datetime.utcnow()
        }
        
        return clean_for_json({
            "success": True,
            "session_id": session_id,
            "preview": trucks_preview[:10],
            "total_rows": len(trucks_preview),
            "errors": errors,
            "columns_found": list(df.columns),
            "sample_data": df.head(5).fillna('').to_dict('records')  # Replace NaN with empty string
        })
        
    except Exception as e:
        raise HTTPException(400, f"Error reading Excel file: {str(e)}")

@app.post("/api/trucks/import/confirm")
async def confirm_excel_import(
    data: dict,
    current_user: UserResponse = Depends(check_permission("user")),
    db: Session = Depends(get_db)
):
    session_id = data.get('session_id')
    session = import_sessions.get(session_id)
    if not session:
        raise HTTPException(400, "Import session not found or expired")
    
    if session['user_id'] != current_user.id:
        raise HTTPException(403, "Unauthorized")
    
    trucks_to_import = session['trucks']
    imported_count = 0
    failed_imports = []
    
    try:
        for index, truck_data in enumerate(trucks_to_import):
            try:
                # Check if shipping_no already exists
                existing = db.query(Truck).filter(Truck.shipping_no == truck_data['shipping_no']).first()
                
                if existing:
                    # Update existing truck
                    for key, value in truck_data.items():
                        setattr(existing, key, value)
                    existing.updated_at = datetime.utcnow()
                    db.commit()
                    db.refresh(existing)
                    created_truck = existing
                else:
                    # Create new truck
                    db_truck = Truck(**truck_data)
                    db_truck.id = str(uuid.uuid4())
                    db_truck.created_at = datetime.utcnow()
                    db.add(db_truck)
                    db.commit()
                    db.refresh(db_truck)
                    created_truck = db_truck
                
                imported_count += 1
                await manager.broadcast({
                    "type": "truck_created",
                    "data": {
                        "id": created_truck.id,
                        "terminal": created_truck.terminal,
                        "shipping_no": created_truck.shipping_no,
                        "dock_code": created_truck.dock_code,
                        "truck_route": created_truck.truck_route,
                        "preparation_start": created_truck.preparation_start,
                        "preparation_end": created_truck.preparation_end,
                        "loading_start": created_truck.loading_start,
                        "loading_end": created_truck.loading_end,
                        "status_preparation": created_truck.status_preparation,
                        "status_loading": created_truck.status_loading,
                        "created_at": created_truck.created_at.isoformat(),
                        "updated_at": created_truck.updated_at.isoformat() if created_truck.updated_at else None
                    }
                })
                    
            except Exception as e:
                failed_imports.append({
                    "row": index + 1,
                    "shipping_no": truck_data.get('shipping_no', 'Unknown'),
                    "error": str(e)
                })
        
        del import_sessions[session_id]
        
        return clean_for_json({
            "success": True,
            "imported": imported_count,
            "failed": len(failed_imports),
            "failed_details": failed_imports,
            "message": f"Successfully imported {imported_count} trucks"
        })
        
    except Exception as e:
        raise HTTPException(500, f"Import failed: {str(e)}")

@app.get("/api/trucks/{truck_id}")
async def get_truck(
    truck_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    truck = db.query(Truck).filter(Truck.id == truck_id).first()
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found")
    
    truck_data = {
        "id": truck.id,
        "terminal": truck.terminal,
        "shipping_no": truck.shipping_no,
        "dock_code": truck.dock_code,
        "truck_route": truck.truck_route,
        "preparation_start": truck.preparation_start,
        "preparation_end": truck.preparation_end,
        "loading_start": truck.loading_start,
        "loading_end": truck.loading_end,
        "status_preparation": truck.status_preparation,
        "status_loading": truck.status_loading,
        "created_at": truck.created_at.isoformat(),
        "updated_at": truck.updated_at.isoformat() if truck.updated_at else None
    }
    
    return clean_for_json(truck_data)

@app.put("/api/trucks/{truck_id}", response_model=TruckSchema)
async def update_truck(
    truck_id: str,
    truck: TruckUpdate,
    current_user: UserResponse = Depends(check_permission("user")),
    db: Session = Depends(get_db)
):
    db_truck = db.query(Truck).filter(Truck.id == truck_id).first()
    if not db_truck:
        raise HTTPException(status_code=404, detail="Truck not found")
    
    update_data = truck.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_truck, key, value)
    
    db_truck.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_truck)
    
    await manager.broadcast({
        "type": "truck_updated",
        "data": {
            "id": db_truck.id,
            "terminal": db_truck.terminal,
            "shipping_no": db_truck.shipping_no,
            "dock_code": db_truck.dock_code,
            "truck_route": db_truck.truck_route,
            "preparation_start": db_truck.preparation_start,
            "preparation_end": db_truck.preparation_end,
            "loading_start": db_truck.loading_start,
            "loading_end": db_truck.loading_end,
            "status_preparation": db_truck.status_preparation,
            "status_loading": db_truck.status_loading,
            "created_at": db_truck.created_at.isoformat(),
            "updated_at": db_truck.updated_at.isoformat() if db_truck.updated_at else None
        }
    })
    
    return db_truck

@app.delete("/api/trucks/{truck_id}")
async def delete_truck(
    truck_id: str,
    current_user: UserResponse = Depends(check_permission("admin")),
    db: Session = Depends(get_db)
):
    db_truck = db.query(Truck).filter(Truck.id == truck_id).first()
    if not db_truck:
        raise HTTPException(status_code=404, detail="Truck not found")
    
    db.delete(db_truck)
    db.commit()
    
    await manager.broadcast({
        "type": "truck_deleted",
        "data": {"id": truck_id}
    })
    
    return {"message": "Truck deleted successfully"}

@app.patch("/api/trucks/{truck_id}/status")
async def update_truck_status(
    truck_id: str,
    status_type: str,
    status: str,
    current_user: UserResponse = Depends(check_permission("user")),
    db: Session = Depends(get_db)
):
    if status_type not in ["preparation", "loading"]:
        raise HTTPException(status_code=400, detail="Invalid status type")
    
    if status not in ["On Process", "Delay", "Finished"]:
        raise HTTPException(status_code=400, detail="Invalid status value")
    
    db_truck = db.query(Truck).filter(Truck.id == truck_id).first()
    if not db_truck:
        raise HTTPException(status_code=404, detail="Truck not found")
    
    if status_type == "preparation":
        db_truck.status_preparation = status
    else:
        db_truck.status_loading = status
    
    db_truck.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_truck)
    
    await manager.broadcast({
        "type": "status_updated",
        "data": {
            "id": db_truck.id,
            "terminal": db_truck.terminal,
            "shipping_no": db_truck.shipping_no,
            "dock_code": db_truck.dock_code,
            "truck_route": db_truck.truck_route,
            "preparation_start": db_truck.preparation_start,
            "preparation_end": db_truck.preparation_end,
            "loading_start": db_truck.loading_start,
            "loading_end": db_truck.loading_end,
            "status_preparation": db_truck.status_preparation,
            "status_loading": db_truck.status_loading,
            "created_at": db_truck.created_at.isoformat(),
            "updated_at": db_truck.updated_at.isoformat() if db_truck.updated_at else None
        }
    })
    
    return db_truck

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    
    print("\n" + "="*60)
    print("🚀 TRUCK MANAGEMENT SYSTEM API - LOCAL DATABASE")
    print("="*60)
    print("📦 Database: SQLite Local (truck_management.db)")
    print("📚 API Documentation: http://localhost:8000/docs")
    print("🔐 Login Credentials:")
    print("   - Admin: admin/admin123")
    print("="*60)
    print("⚡ WebSocket: ws://localhost:8000/ws")
    print("🏥 Health Check: http://localhost:8000/health")
    print("="*60 + "\n")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)